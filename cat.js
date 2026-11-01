/* =========================================
   BTU ELIBRARY - SUPABASE CAT SYSTEM
========================================= */

const supabaseClient = window.supabaseClient;

if (!supabaseClient) {
  throw new Error("Supabase client is not initialized.");
}

/* =========================================
   PAGE ELEMENTS
========================================= */

const catForm = document.getElementById("cat-answer-form");
const noAssessmentMessage = document.getElementById("no-assessment-message");

const availableCATsList = document.getElementById("available-cats-list");

const catListMessage = document.getElementById("cat-list-message");

const resultsList = document.getElementById("student-results-list");

const resultsMessage = document.getElementById("results-message");

const catResultMessage = document.createElement("div");

catResultMessage.id = "cat-result-message";
catResultMessage.setAttribute("role", "status");
catResultMessage.setAttribute("aria-live", "polite");

if (catForm) {
  catForm.appendChild(catResultMessage);
}

/* =========================================
   CAT STATE
========================================= */

let assessmentQuestions = [];
let currentQuestionIndex = 0;
let studentAnswers = {};

let currentCAT = null;
let currentAttempt = null;

let countdownInterval = null;
let isSubmitting = false;

/* =========================================
   CAT LOCKDOWN MONITORING
========================================= */

let violationCount = 0;
let monitoringStarted = false;
let lastViolationTime = 0;

function showLockdownWarning(message) {
  let warning = document.getElementById("cat-lockdown-warning");

  if (!warning) {
    warning = document.createElement("div");
    warning.id = "cat-lockdown-warning";

    warning.style.cssText = `
      position: fixed;
      top: 15px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      width: min(90%, 500px);
      padding: 16px;
      background: #8b0000;
      color: white;
      border-radius: 8px;
      text-align: center;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;

    document.body.appendChild(warning);
  }

  warning.textContent = message;

  clearTimeout(warning.hideTimer);

  warning.hideTimer = setTimeout(() => {
    warning.remove();
  }, 5000);
}

async function recordCATViolation(eventType, details = {}) {
  if (!currentCAT || !currentAttempt || isSubmitting) return;

  const attemptId = currentAttempt.attempt_id || currentAttempt.id;

  if (!attemptId) {
    console.error("Cannot record violation: attempt ID is missing.");
    return;
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    console.error("Cannot record violation: student is not authenticated.");
    return;
  }

  const now = Date.now();

  // Prevent repeated logging of the same event within 2 seconds.
  if (
    recordCATViolation.lastEventType === eventType &&
    now - (recordCATViolation.lastEventTime || 0) < 2000
  ) {
    return;
  }

  recordCATViolation.lastEventType = eventType;
  recordCATViolation.lastEventTime = now;

  violationCount++;

  const { error } = await supabaseClient.from("cat_violations").insert({
    cat_id: currentCAT.id,
    attempt_id: attemptId,
    student_id: user.id,
    event_type: eventType,
    details: {
      ...details,
      incident_number: violationCount,
      recorded_at: new Date().toISOString(),
    },
  });

  if (error) {
    console.error("Could not record CAT violation:", error);
  } else {
    console.log("CAT violation recorded:", eventType);
  }
}

function startCATMonitoring() {
  if (monitoringStarted) {
    console.log("CAT monitoring is already running.");
    return;
  }

  monitoringStarted = true;

  console.log("CAT monitoring started.");
  console.log("Current CAT:", currentCAT?.id);
  console.log(
    "Current attempt:",
    currentAttempt?.attempt_id || currentAttempt?.id,
  );

  // Detect tab switching.
  document.addEventListener("visibilitychange", () => {
    console.log("Visibility changed. Document hidden:", document.hidden);

    if (document.hidden) {
      showLockdownWarning("Warning: Leaving the CAT tab has been detected.");

      recordCATViolation("tab_switch", {
        message: "Student switched away from the CAT tab.",
      });
    }
  });

  // Detect browser window losing focus.
  window.addEventListener("blur", () => {
    console.log("Browser window lost focus.");

    recordCATViolation("window_blur", {
      message: "Browser window lost focus.",
    });
  });

  // Detect fullscreen exit.
  document.addEventListener("fullscreenchange", () => {
    console.log("Fullscreen changed:", !!document.fullscreenElement);

    if (!document.fullscreenElement) {
      showLockdownWarning("Warning: Exiting fullscreen has been detected.");

      recordCATViolation("fullscreen_exit", {
        message: "Student exited fullscreen mode.",
      });
    }
  });
}

/* =========================================
   HELPER FUNCTIONS
========================================= */

function showMessage(element, message) {
  if (element) {
    element.textContent = message;
  }
}

function setQuestionFormEnabled(enabled) {
  if (!catForm) return;

  catForm.querySelectorAll("input, button").forEach((element) => {
    element.disabled = !enabled;
  });
}

function showCATQuestion(question) {
  if (!question || !catForm || !noAssessmentMessage) return;

  document.getElementById("question-text").textContent = question.text;

  noAssessmentMessage.hidden = true;
  catForm.hidden = false;
}

/* =========================================
   LOAD PUBLISHED CATs
========================================= */

async function displayAvailableCATs() {
  if (!availableCATsList || !catListMessage) return;

  availableCATsList.replaceChildren();
  showMessage(catListMessage, "Loading assessments...");

  const { data: cats, error } = await supabaseClient
    .from("cats")
    .select("id, title, course, instructions, duration")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("CAT loading error:", error);
    showMessage(catListMessage, "Could not load available CATs.");
    return;
  }

  if (!cats || cats.length === 0) {
    showMessage(catListMessage, "No CATs are available yet.");
    return;
  }

  // Check whether the student was redirected here for a specific CAT.
  const requestedCATId = new URLSearchParams(window.location.search).get("cat");

  let requestedCATFound = false;

  cats.forEach((cat) => {
    const card = document.createElement("article");
    card.className = "created-cat-card";

    const title = document.createElement("h3");
    title.textContent = cat.title;

    const course = document.createElement("p");
    course.textContent = "Course: " + cat.course;

    const duration = document.createElement("p");
    duration.textContent = "Duration: " + cat.duration + " minutes";

    const instructions = document.createElement("p");
    instructions.textContent =
      cat.instructions || "No additional instructions.";

    const startButton = document.createElement("button");
    startButton.type = "button";
    startButton.textContent = "Start CAT";

    startButton.addEventListener("click", async () => {
      startButton.disabled = true;
      await beginOrResumeCAT(cat);
      startButton.disabled = false;
    });

    card.append(title, course, duration, instructions, startButton);
    availableCATsList.appendChild(card);

    // Automatically resume the CAT requested by student-auth.js.
    if (requestedCATId === cat.id) {
      requestedCATFound = true;

      startButton.textContent = "Resume CAT";
      startButton.disabled = true;

      // Automatically open the existing attempt.
      beginOrResumeCAT(cat).finally(() => {
        startButton.disabled = false;
      });
    }
  });

  if (requestedCATId && !requestedCATFound) {
    showMessage(
      catListMessage,
      "The requested CAT could not be found. Please contact your lecturer.",
    );
    return;
  }

  if (!requestedCATId) {
    showMessage(catListMessage, cats.length + " CAT(s) available.");
  }
}

/* =========================================
   START OR RESUME CAT
========================================= */

async function beginOrResumeCAT(cat) {
  if (currentAttempt && currentCAT?.id !== cat.id) {
    showMessage(
      catResultMessage,
      "Finish your current CAT before opening another.",
    );
    return;
  }

  showMessage(catListMessage, "Checking your CAT attempt...");

  // Check whether the student already has an attempt.
  const { data: existingAttempt, error: attemptError } =
    await supabaseClient.rpc("get_active_cat_attempt", {
      p_cat_id: cat.id,
    });

  if (attemptError) {
    console.error("Attempt check error:", attemptError);
    showMessage(catListMessage, attemptError.message);
    return;
  }

  if (existingAttempt?.status === "submitted") {
    showMessage(catListMessage, "You have already submitted this CAT.");
    return;
  }

  if (existingAttempt?.status === "expired") {
    showMessage(catListMessage, "Your attempt for this CAT has expired.");

    // Submit an empty answer object so the server records expiry.
    const { error } = await supabaseClient.rpc("submit_cat_attempt", {
      p_cat_id: cat.id,
      p_answers: {},
    });

    if (error) {
      console.error("Expiry submission error:", error);
    }

    return;
  }

  let attempt = existingAttempt;

  // Create a new attempt only if none exists.
  if (!attempt) {
    const { data: newAttempt, error: startError } = await supabaseClient.rpc(
      "start_cat_attempt",
      {
        p_cat_id: cat.id,
      },
    );

    if (startError) {
      console.error("CAT start error:", startError);
      showMessage(catListMessage, startError.message);
      return;
    }

    const { data: activeAttempt, error: activeError } =
      await supabaseClient.rpc("get_active_cat_attempt", {
        p_cat_id: cat.id,
      });

    if (activeError || !activeAttempt?.attempt_id) {
      console.error("Could not retrieve the new attempt ID:", activeError);
      showMessage(
        catListMessage,
        "CAT started, but its attempt details could not be retrieved.",
      );
      return;
    }

    attempt = activeAttempt;
  }

  currentCAT = cat;
  currentAttempt = attempt;

  await loadCATQuestions(cat);
}

/* =========================================
   LOAD QUESTIONS SECURELY
========================================= */

async function loadCATQuestions(cat) {
  showMessage(catListMessage, "Loading CAT questions...");

  const { data: questions, error } = await supabaseClient.rpc(
    "get_published_cat_questions",
    {
      p_cat_id: cat.id,
    },
  );

  if (error) {
    console.error("Question loading error:", error);
    showMessage(catListMessage, error.message);
    return;
  }

  if (!questions || questions.length === 0) {
    showMessage(catListMessage, "No questions are available.");
    return;
  }

  assessmentQuestions = questions.map((question) => ({
    id: question.id,
    text: question.question,
    options: {
      A: question.option_a,
      B: question.option_b,
      C: question.option_c,
      D: question.option_d,
    },
  }));

  currentQuestionIndex = 0;
  studentAnswers = {};

  document.querySelector(".cat-instructions h2").textContent = cat.title;

  document.querySelector(".cat-instructions p").textContent =
    cat.instructions || "Answer all questions before submitting.";

  noAssessmentMessage.hidden = true;
  catForm.hidden = false;

  setQuestionFormEnabled(true);
  catForm.dataset.submitted = "false";

  // Add a fullscreen button if it doesn't already exist.
  let fullscreenButton = document.getElementById("cat-fullscreen-button");

  if (!fullscreenButton) {
    fullscreenButton = document.createElement("button");
    fullscreenButton.id = "cat-fullscreen-button";
    fullscreenButton.type = "button";
    fullscreenButton.textContent = "Enter Fullscreen";

    catForm.prepend(fullscreenButton);

    fullscreenButton.addEventListener("click", async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (error) {
        console.error("Fullscreen request failed:", error);
        showLockdownWarning(
          "Fullscreen could not be enabled. Please check your browser.",
        );
      }
    });
  }

  showMessage(
    catResultMessage,
    "CAT started. Your time is limited to the published duration.",
  );

  // Start monitoring only after the active CAT has loaded.
  startCATMonitoring();

  displayCurrentQuestion();
  startCATCountdown();

  document.getElementById("cat-questions").scrollIntoView({
    behavior: "smooth",
    block: "start",
  });

  showMessage(catListMessage, "CAT loaded successfully.");
}

/* =========================================
   QUESTION NAVIGATION
========================================= */

function displayCurrentQuestion() {
  if (assessmentQuestions.length === 0) return;

  const question = assessmentQuestions[currentQuestionIndex];

  showCATQuestion(question);

  document.getElementById("answer-a-text").textContent = question.options.A;

  document.getElementById("answer-b-text").textContent = question.options.B;

  document.getElementById("answer-c-text").textContent = question.options.C;

  document.getElementById("answer-d-text").textContent = question.options.D;

  document.getElementById("question-counter").textContent =
    `Question ${currentQuestionIndex + 1} of ${assessmentQuestions.length}`;

  document.getElementById("previous-question").disabled =
    currentQuestionIndex === 0;

  document.getElementById("next-question").disabled =
    currentQuestionIndex === assessmentQuestions.length - 1;

  const savedAnswer = studentAnswers[question.id] || null;

  document.querySelectorAll('input[name="answer"]').forEach((input) => {
    input.checked = input.value === savedAnswer;
  });
}

function goToNextQuestion() {
  if (currentQuestionIndex < assessmentQuestions.length - 1) {
    currentQuestionIndex++;
    displayCurrentQuestion();
  }
}

function goToPreviousQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    displayCurrentQuestion();
  }
}

document
  .getElementById("next-question")
  ?.addEventListener("click", goToNextQuestion);

document
  .getElementById("previous-question")
  ?.addEventListener("click", goToPreviousQuestion);

/* =========================================
   SAVE ANSWERS IN CURRENT SESSION
========================================= */

document.querySelectorAll('input[name="answer"]').forEach((input) => {
  input.addEventListener("change", () => {
    if (assessmentQuestions.length === 0) return;

    const question = assessmentQuestions[currentQuestionIndex];

    studentAnswers[question.id] = input.value;
  });
});

/* =========================================
   CAT COUNTDOWN
========================================= */

function startCATCountdown() {
  clearInterval(countdownInterval);

  if (!currentAttempt?.expires_at) return;

  function updateCountdown() {
    const expiryTime = new Date(currentAttempt.expires_at).getTime();
    const remaining = Math.max(0, expiryTime - Date.now());

    if (remaining <= 0) {
      clearInterval(countdownInterval);
      showMessage(catResultMessage, "Time has expired. Submitting CAT...");
      submitCAT(true);
      return;
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    showMessage(
      catResultMessage,
      `Time remaining: ${minutes}:${String(seconds).padStart(2, "0")}`,
    );
  }

  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

/* =========================================
   SUBMIT CAT - SERVER-SIDE GRADING
========================================= */

async function submitCAT(timeExpired = false) {
  if (!currentCAT || !currentAttempt || isSubmitting) return;

  if (catForm.dataset.submitted === "true") return;

  if (!timeExpired) {
    const unanswered = assessmentQuestions.filter(
      (question) => !studentAnswers[question.id],
    );

    if (unanswered.length > 0) {
      showMessage(
        catResultMessage,
        `You still have ${unanswered.length} unanswered question(s).`,
      );
      return;
    }
  }

  const confirmed = timeExpired
    ? true
    : window.confirm("Are you sure you want to submit your CAT?");

  if (!confirmed) return;

  isSubmitting = true;
  setQuestionFormEnabled(false);

  showMessage(catResultMessage, "Submitting your CAT securely...");

  const { data: result, error } = await supabaseClient.rpc(
    "submit_cat_attempt",
    {
      p_cat_id: currentCAT.id,
      p_answers: studentAnswers,
    },
  );

  if (error) {
    console.error("CAT submission error:", error);

    showMessage(
      catResultMessage,
      "Submission failed: " + error.message + ". Please contact your lecturer.",
    );

    isSubmitting = false;
    setQuestionFormEnabled(true);
    return;
  }

  clearInterval(countdownInterval);

  catForm.dataset.submitted = "true";

  showMessage(
    catResultMessage,
    `CAT submitted. Score: ${result.score} / ${result.total_questions}. Percentage: ${result.percentage}%.`,
  );

  setQuestionFormEnabled(false);

  currentAttempt = null;
  isSubmitting = false;

  await displayStudentResults();
}

catForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  submitCAT(false);
});

/* =========================================
   DISPLAY SUPABASE CAT RESULTS
========================================= */

async function displayStudentResults() {
  if (!resultsList || !resultsMessage) return;

  resultsList.replaceChildren();

  const { data: results, error } = await supabaseClient
    .from("cat_attempts")
    .select(
      `
      score,
      total_questions,
      submitted_at,
      cats (
        title,
        course
      )
    `,
    )
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("Results loading error:", error);
    showMessage(resultsMessage, "Could not load your CAT results.");
    return;
  }

  if (!results || results.length === 0) {
    showMessage(resultsMessage, "No completed CAT results yet.");
    return;
  }

  showMessage(resultsMessage, "Your completed CAT results:");

  results.forEach((result) => {
    const percentage =
      result.total_questions > 0
        ? Math.round((result.score / result.total_questions) * 100)
        : 0;

    const card = document.createElement("article");
    card.className = "created-cat-card";

    const title = document.createElement("h3");
    title.textContent = result.cats?.title || "CAT";

    const course = document.createElement("p");
    course.textContent = "Course: " + (result.cats?.course || "N/A");

    const score = document.createElement("p");
    score.textContent = `Score: ${result.score} out of ${result.total_questions}`;

    const percentageText = document.createElement("p");
    percentageText.textContent = "Percentage: " + percentage + "%";

    const date = document.createElement("p");
    date.textContent =
      "Submitted: " + new Date(result.submitted_at).toLocaleString();

    card.append(title, course, score, percentageText, date);
    resultsList.appendChild(card);
  });
}

/* =========================================
   INITIALIZE PAGE
========================================= */

async function initializeCATPage() {
  try {
    const {
      data: { user },
      error,
    } = await supabaseClient.auth.getUser();

    if (error || !user) {
      window.location.replace("login.html");
      return;
    }

    // Verify that this account belongs to a student.
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) throw roleError;

    if (!roleData || roleData.role !== "student") {
      window.location.replace("login.html");
      return;
    }

    console.log("Authenticated student:", user.id);

    await displayAvailableCATs();
    await displayStudentResults();
  } catch (error) {
    console.error("CAT page initialization failed:", error);

    showMessage(
      catListMessage,
      "Unable to initialize the CAT page. Please try again.",
    );
  }
}

initializeCATPage();
