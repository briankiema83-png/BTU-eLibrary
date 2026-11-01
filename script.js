let libraryMaterials = [];

function loadLibraryMaterials() {
  try {
    const saved = localStorage.getItem("btuLearningMaterials");
    const parsed = saved ? JSON.parse(saved) : [];

    libraryMaterials = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Student library loading failed:", error);

    if (resultsCount) {
      resultsCount.textContent = "Unable to load materials";
    }

    libraryContent.replaceChildren();

    const errorMessage = document.createElement("div");
    errorMessage.className = "library-error";
    errorMessage.setAttribute("role", "alert");

    const heading = document.createElement("h3");
    heading.textContent = "We couldn't load your learning materials";

    const explanation = document.createElement("p");
    explanation.textContent =
      "Please check your internet connection and try again. If the problem continues, contact your lecturer or administrator.";

    errorMessage.append(heading, explanation);

    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.className = "login-button";
    retryButton.textContent = "Try Again";

    retryButton.addEventListener("click", function () {
      loadStudentLibrary();
    });

    errorMessage.appendChild(retryButton);
    libraryContent.appendChild(errorMessage);
  }
}

const searchInput = document.getElementById("library-search");
const courseFilter = document.getElementById("course-filter");
const libraryContent = document.getElementById("library-content");
const sortSelect = document.getElementById("library-sort");
const previousButton = document.getElementById("library-previous");
const nextButton = document.getElementById("library-next");
const pageInfo = document.getElementById("library-page-info");

const materialsPerPage = 6;
let currentPage = 1;
function displayMaterials(materials) {
  if (!libraryContent) {
    return;
  }

  if (materials.length === 0) {
    libraryContent.innerHTML = `
            <p class="empty-state">
                No materials available yet.
            </p>
        `;
    return;
  }

  libraryContent.innerHTML = "";

  materials.forEach(function (material) {
    const card = document.createElement("article");
    card.className = "material-card";

    const title = document.createElement("h3");
    title.textContent = material.title;

    const course = document.createElement("p");
    course.textContent = "Course: " + material.course;

    const description = document.createElement("p");
    description.textContent = material.description;

    card.appendChild(title);
    card.appendChild(course);
    card.appendChild(description);

    if (material.link) {
      const link = document.createElement("a");
      link.href = material.link;
      link.textContent = "Open Material";
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      card.appendChild(link);
    }

    libraryContent.appendChild(card);
  });
}

if (searchInput && libraryContent) {
  loadLibraryMaterials();

  searchInput.addEventListener("input", function () {
    const searchTerm = searchInput.value.toLowerCase().trim();

    const filteredMaterials = libraryMaterials.filter(function (material) {
      return (
        material.title.toLowerCase().includes(searchTerm) ||
        material.course.toLowerCase().includes(searchTerm)
      );
    });

    displayMaterials(filteredMaterials);
  });

  displayMaterials(libraryMaterials);
}

/* ONLINE CAT DATA */

const catAssessments = [];

function displayCATs(assessments) {
  const catsContent = document.getElementById("cats-content");

  if (!catsContent) return;

  if (!assessments || assessments.length === 0) {
    catsContent.innerHTML = '<p class="empty-state">No CATs scheduled.</p>';
    return;
  }

  catsContent.replaceChildren();

  assessments.forEach(function (assessment) {
    const card = document.createElement("article");
    card.className = "cat-card";

    const title = document.createElement("h3");
    title.textContent = assessment.title;

    const course = document.createElement("p");
    course.textContent = "Course: " + assessment.course;

    const instructions = document.createElement("p");
    instructions.textContent = "Instructions: " + assessment.instructions;

    const duration = document.createElement("p");
    duration.textContent = "Duration: " + assessment.duration + " minutes";

    const status = document.createElement("span");
    status.className = "cat-status";
    status.textContent = "Available";

    const startButton = document.createElement("button");
    startButton.type = "button";
    startButton.textContent = "Start CAT";

    startButton.addEventListener("click", function () {
      startCAT(assessment.id);
    });

    card.append(title, course, instructions, duration, status, startButton);

    catsContent.appendChild(card);
  });
}

displayCATs(catAssessments);

/* ---------------- SUPABASE LOGIN ---------------- */

const loginForm = document.getElementById("login-form");

if (loginForm) {
  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("user-email").value.trim();
    const password = document.getElementById("password").value;
    const loginButton = loginForm.querySelector('button[type="submit"]');

    loginButton.disabled = true;
    loginButton.textContent = "Signing in...";

    try {
      const { data, error } =
        await window.supabaseClient.auth.signInWithPassword({
          email: email,
          password: password,
        });

      if (error) {
        alert("Sign-in failed: " + error.message);
        return;
      }

      const user = data.user;

      // Get the logged-in user's role from Supabase
      const { data: roleData, error: roleError } = await window.supabaseClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleError) {
        throw roleError;
      }

      // Deny access if the account has no assigned role
      if (!roleData) {
        await window.supabaseClient.auth.signOut();
        alert("Access denied. Your account has no assigned role.");
        return;
      }

      // Redirect according to the assigned role
      if (roleData.role === "lecturer") {
        window.location.href = "lecturer.html";
      } else if (roleData.role === "student") {
        window.location.href = "student.html";
      } else {
        await window.supabaseClient.auth.signOut();
        alert("Access denied. Your account has an unrecognized role.");
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("Unable to sign in. Please check your connection and try again.");
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = "Sign In";
    }
  });
}

/* -------- AUTHENTICATED DATABASE TEST -------- */

async function testAuthenticatedDatabase() {
  if (!window.supabase || typeof window.supabaseClient === "undefined") {
    console.error("Supabase client is not available.");
    return;
  }

  const { data: sessionData, error: sessionError } =
    await window.supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    console.log("No signed-in session found on this page.");
    return;
  }

  const { data, error } = await window.supabaseClient
    .from("learning_materials")
    .select("id")
    .limit(1);

  if (error) {
    console.error("Authenticated database test failed:", error.message);
    return;
  }

  console.log("Authenticated database access successful!");
  console.log("Materials found:", data.length);
}

async function loadStudentLibrary() {
  if (window.libraryLoadingInProgress) return;
  window.libraryLoadingInProgress = true;
  const libraryLoading = document.getElementById("library-loading");

  if (libraryLoading) {
    libraryLoading.hidden = false;
  }
  const resultsCount = document.getElementById("library-results-count");
  const libraryContent = document.getElementById("library-content");
  const searchInput = document.getElementById("library-search");

  if (!libraryContent) return;

  libraryContent.textContent = "Loading learning materials...";

  try {
    const { data: sessionData, error: sessionError } =
      await window.supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;

    if (!sessionData.session) {
      libraryContent.textContent =
        "Please sign in to access learning materials.";
      return;
    }

    const { data, error } = await window.supabaseClient
      .from("learning_materials")
      .select(
        "id, title, course, description, file_path, external_link, created_at",
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    const materials = data || [];
    // Populate the dropdown with courses from Supabase
    if (courseFilter) {
      const courses = [
        ...new Set(
          materials.map((material) => material.course).filter(Boolean),
        ),
      ].sort();

      courseFilter.replaceChildren();

      const allCoursesOption = document.createElement("option");
      allCoursesOption.value = "";
      allCoursesOption.textContent = "All courses";
      courseFilter.appendChild(allCoursesOption);

      courses.forEach((courseName) => {
        const option = document.createElement("option");
        option.value = courseName;
        option.textContent = courseName;
        courseFilter.appendChild(option);
      });
    }

    function renderStudentMaterials(searchTerm = "", selectedCourse = "") {
      libraryContent.replaceChildren();

      const filteredMaterials = materials.filter(function (material) {
        const searchableText = [
          material.title,
          material.course,
          material.description,
        ]
          .join(" ")
          .toLowerCase();

        const matchesSearch = searchableText.includes(searchTerm.toLowerCase());

        const matchesCourse =
          !selectedCourse || material.course === selectedCourse;

        return matchesSearch && matchesCourse;
      });

      filteredMaterials.sort(function (a, b) {
        const sortMode = sortSelect ? sortSelect.value : "newest";

        if (sortMode === "oldest") {
          return new Date(a.created_at) - new Date(b.created_at);
        }

        if (sortMode === "title") {
          return a.title.localeCompare(b.title);
        }

        return new Date(b.created_at) - new Date(a.created_at);
      });
      if (resultsCount) {
        if (filteredMaterials.length === 0) {
          resultsCount.textContent = "No materials found";
        } else {
          const start = (currentPage - 1) * materialsPerPage + 1;
          const end = Math.min(
            currentPage * materialsPerPage,
            filteredMaterials.length,
          );

          resultsCount.textContent = `Showing ${start}–${end} of ${filteredMaterials.length} materials`;
        }
      }
      const totalPages = Math.max(
        1,
        Math.ceil(filteredMaterials.length / materialsPerPage),
      );

      currentPage = Math.min(currentPage, totalPages);

      const startIndex = (currentPage - 1) * materialsPerPage;

      const paginatedMaterials = filteredMaterials.slice(
        startIndex,
        startIndex + materialsPerPage,
      );

      if (previousButton) {
        previousButton.disabled = currentPage === 1;
      }

      if (nextButton) {
        nextButton.disabled = currentPage === totalPages;
      }

      if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
      }

      if (filteredMaterials.length === 0) {
        const message = document.createElement("p");
        message.className = "empty-state";
        message.textContent = searchTerm
          ? "No materials match your search."
          : "No learning materials are available yet.";

        libraryContent.appendChild(message);
        return;
      }

      paginatedMaterials.forEach(function (material) {
        const card = document.createElement("div");
        card.className = "created-cat-card";

        const title = document.createElement("h3");
        title.textContent = material.title;

        const course = document.createElement("p");
        course.textContent = "Course: " + material.course;

        const description = document.createElement("p");
        description.textContent = material.description;

        const uploadDate = document.createElement("p");

        if (material.created_at) {
          const date = new Date(material.created_at);

          uploadDate.textContent =
            "Uploaded: " +
            date.toLocaleDateString("en-KE", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
        } else {
          uploadDate.textContent = "Upload date unavailable";
        }

        uploadDate.className = "material-upload-date";

        card.append(title, course, description, uploadDate);

        if (material.file_path) {
          const isPdf = material.file_path
            .split("?")[0]
            .toLowerCase()
            .endsWith(".pdf");

          if (isPdf) {
            const previewButton = document.createElement("button");
            previewButton.type = "button";
            previewButton.className = "login-button";
            previewButton.textContent = "Preview PDF";

            previewButton.addEventListener("click", async function () {
              const previewSection = document.getElementById(
                "pdf-preview-section",
              );
              const previewTitle = document.getElementById("pdf-preview-title");
              const previewFrame = document.getElementById("pdf-preview-frame");

              if (!previewSection || !previewTitle || !previewFrame) {
                alert(
                  "PDF preview area was not found. Please check student.html.",
                );
                return;
              }

              previewButton.disabled = true;
              previewButton.textContent = "Preparing preview...";

              try {
                const { data, error } = await window.supabaseClient.storage
                  .from("learning-materials")
                  .createSignedUrl(material.file_path, 600);

                if (error) throw error;

                previewTitle.textContent = material.title;
                previewFrame.src = data.signedUrl;
                previewSection.hidden = false;
                previewSection.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              } catch (error) {
                console.error("PDF preview failed:", error);
                alert("Could not preview this PDF. Please try again.");
              } finally {
                previewButton.disabled = false;
                previewButton.textContent = "Preview PDF";
              }
            });

            card.appendChild(previewButton);
          }

          const button = document.createElement("button");
          button.type = "button";
          button.className = "login-button";
          button.textContent = "Open / Download Material";

          button.addEventListener("click", async function () {
            button.disabled = true;
            button.textContent = "Preparing download...";

            try {
              const { data: signedData, error: signedError } =
                await window.supabaseClient.storage
                  .from("learning-materials")
                  .createSignedUrl(material.file_path, 600);

              if (signedError) throw signedError;

              const link = document.createElement("a");
              link.href = signedData.signedUrl;
              link.target = "_blank";
              link.rel = "noopener noreferrer";
              link.click();
            } catch (error) {
              console.error("Student download failed:", error);
              alert("Could not open the file. Please try again.");
            } finally {
              button.disabled = false;
              button.textContent = "Open / Download Material";
            }
          });

          card.appendChild(button);
        }

        if (material.external_link) {
          const link = document.createElement("a");
          link.href = material.external_link;
          link.textContent = "Open External Material";
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          card.appendChild(link);
        }

        libraryContent.appendChild(card);
      });
    }

    renderStudentMaterials();

    if (searchInput && !searchInput.dataset.librarySearchReady) {
      searchInput.addEventListener("input", function () {
        currentPage = 1;

        renderStudentMaterials(
          searchInput.value.trim(),
          courseFilter ? courseFilter.value : "",
        );
      });

      searchInput.dataset.librarySearchReady = "true";
    }

    if (courseFilter && !courseFilter.dataset.courseFilterReady) {
      courseFilter.addEventListener("change", function () {
        currentPage = 1;
        renderStudentMaterials(
          searchInput ? searchInput.value.trim() : "",
          courseFilter.value,
        );
      });

      courseFilter.dataset.courseFilterReady = "true";
    }

    if (sortSelect && !sortSelect.dataset.sortReady) {
      sortSelect.addEventListener("change", function () {
        currentPage = 1;
        renderStudentMaterials(
          searchInput ? searchInput.value.trim() : "",
          courseFilter ? courseFilter.value : "",
        );
      });

      sortSelect.dataset.sortReady = "true";
    }

    if (previousButton && !previousButton.dataset.paginationReady) {
      previousButton.addEventListener("click", function () {
        if (currentPage > 1) {
          currentPage--;
          renderStudentMaterials(
            searchInput ? searchInput.value.trim() : "",
            courseFilter ? courseFilter.value : "",
          );
        }
      });

      previousButton.dataset.paginationReady = "true";
    }

    if (nextButton && !nextButton.dataset.paginationReady) {
      nextButton.addEventListener("click", function () {
        currentPage++;
        renderStudentMaterials(
          searchInput ? searchInput.value.trim() : "",
          courseFilter ? courseFilter.value : "",
        );
      });

      nextButton.dataset.paginationReady = "true";
    }
    const closePreviewButton = document.getElementById("close-pdf-preview");

    if (closePreviewButton && !closePreviewButton.dataset.previewReady) {
      closePreviewButton.addEventListener("click", function () {
        const previewSection = document.getElementById("pdf-preview-section");

        const previewFrame = document.getElementById("pdf-preview-frame");

        if (previewFrame) {
          previewFrame.src = "about:blank";
        }

        if (previewSection) {
          previewSection.hidden = true;
        }
      });

      closePreviewButton.dataset.previewReady = "true";
    }
  } catch (error) {
    console.error("Student library loading failed:", error);

    libraryContent.textContent =
      "Could not load learning materials. Please refresh and try again.";
  } finally {
    window.libraryLoadingInProgress = false;

    if (libraryLoading) {
      libraryLoading.hidden = true;
    }
  }
}

if (document.getElementById("library-content")) {
  loadStudentLibrary();
}
/* -------- STUDENT PROFILE -------- */

async function loadStudentProfile() {
  const profileEmail = document.getElementById("profile-email");
  const profileName = document.getElementById("profile-name");
  const profileRole = document.getElementById("profile-role");
  const profileInitial = document.getElementById("profile-initial");

  // Only run on the student page
  if (!profileEmail) return;

  try {
    const { data, error } = await window.supabaseClient.auth.getUser();

    if (error) throw error;

    const user = data.user;

    if (!user) {
      window.location.replace("login.html");
      return;
    }

    const fullName = user.user_metadata?.full_name || "Not provided";

    profileEmail.textContent = user.email || "Not available";
    profileName.textContent = fullName;
    profileRole.textContent = "Student";
    const editProfileButton = document.getElementById("edit-profile-btn");

    if (editProfileButton) {
      editProfileButton.addEventListener("click", async function () {
        const newName = prompt(
          "Enter your full name:",
          fullName === "Not provided" ? "" : fullName,
        );

        if (newName === null) return;

        if (!newName.trim()) {
          alert("Please enter your full name.");
          return;
        }

        editProfileButton.disabled = true;
        editProfileButton.textContent = "Saving...";

        try {
          const { error } = await window.supabaseClient.auth.updateUser({
            data: { full_name: newName.trim() },
          });

          if (error) throw error;

          profileName.textContent = newName.trim();
          profileInitial.textContent = newName.trim().charAt(0).toUpperCase();

          alert("Your profile has been updated successfully!");
        } catch (error) {
          console.error("Profile update failed:", error);
          alert("Could not update your profile. Please try again.");
        } finally {
          editProfileButton.disabled = false;
          editProfileButton.textContent = "Edit Profile";
        }
      });
    }
    profileInitial.textContent =
      fullName.charAt(0).toUpperCase() === "N"
        ? (user.email || "S").charAt(0).toUpperCase()
        : fullName.charAt(0).toUpperCase();
  } catch (error) {
    console.error("Student profile loading failed:", error);
    profileEmail.textContent = "Unable to load profile";
  }
}

loadStudentProfile();
/* -------- STUDENT SIGN OUT -------- */

const studentSignoutButton = document.getElementById("student-signout-btn");

if (studentSignoutButton) {
  studentSignoutButton.addEventListener("click", async function () {
    studentSignoutButton.disabled = true;
    studentSignoutButton.textContent = "Signing out...";

    try {
      const { error } = await window.supabaseClient.auth.signOut();

      if (error) throw error;

      window.location.replace("login.html");
    } catch (error) {
      console.error("Sign out failed:", error);
      alert("Unable to sign out. Please try again.");

      studentSignoutButton.disabled = false;
      studentSignoutButton.textContent = "Sign Out";
    }
  });
}
/* -------- LOAD PUBLISHED CATS FOR STUDENTS -------- */

async function loadStudentCATs() {
  const catsContent = document.getElementById("cats-content");

  if (!catsContent) return;

  catsContent.textContent = "Loading available CATs...";

  try {
    const { data, error } = await window.supabaseClient
      .from("cats")
      .select("id, title, course, instructions, duration, created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    displayCATs(data || []);
  } catch (error) {
    console.error("Could not load student CATs:", error);

    catsContent.textContent = "Unable to load CATs. Please try again later.";
  }
}
/* -------- START CAT EXAMINATION -------- */
async function startCAT(catId) {
  const examArea = document.getElementById("cat-exam-area");
  const questionsContainer = document.getElementById("cat-questions-container");
  const examTitle = document.getElementById("exam-title");
  const examInstructions = document.getElementById("exam-instructions");
  const timerDisplay = document.getElementById("cat-timer");
  const submitButton = document.getElementById("submit-cat-button");

  if (window.catTimerInterval) {
    clearInterval(window.catTimerInterval);
  }

  examArea.hidden = false;
  questionsContainer.textContent = "Starting CAT...";
  examTitle.textContent = "Loading CAT...";
  examInstructions.textContent = "";
  submitButton.disabled = true;

  try {
    // Get the published CAT details
    const { data: cat, error: catError } = await window.supabaseClient
      .from("cats")
      .select("id, title, instructions, duration")
      .eq("id", catId)
      .eq("is_published", true)
      .single();

    if (catError) throw catError;

    // Register the official attempt and deadline on Supabase
    const { data: attempt, error: attemptError } =
      await window.supabaseClient.rpc("start_cat_attempt", {
        p_cat_id: catId,
      });

    if (attemptError) throw attemptError;

    // Retrieve questions without correct answers
    const { data: questions, error: questionError } =
      await window.supabaseClient.rpc("get_published_cat_questions", {
        p_cat_id: catId,
      });

    if (questionError) throw questionError;

    if (!questions || questions.length === 0) {
      throw new Error("This CAT has no questions yet.");
    }

    // Store the current CAT information
    window.currentCATId = catId;
    window.currentCATQuestions = questions;
    window.currentCATDeadline = new Date(attempt.expires_at).getTime();

    examTitle.textContent = cat.title;
    examInstructions.textContent =
      cat.instructions + " | Duration: " + cat.duration + " minutes";

    questionsContainer.replaceChildren();

    questions.forEach(function (question, index) {
      const questionCard = document.createElement("div");
      questionCard.className = "exam-question";

      const heading = document.createElement("h3");
      heading.textContent =
        "Question " + (index + 1) + ": " + question.question;

      questionCard.appendChild(heading);

      const options = [
        ["A", question.option_a],
        ["B", question.option_b],
        ["C", question.option_c],
        ["D", question.option_d],
      ];

      options.forEach(function (option) {
        const label = document.createElement("label");
        const radio = document.createElement("input");

        radio.type = "radio";
        radio.name = "question-" + question.id;
        radio.value = option[0];
        radio.required = true;

        label.append(radio, " " + option[0] + ". " + option[1]);
        questionCard.appendChild(label);
      });

      questionsContainer.appendChild(questionCard);
    });

    // Countdown based on the official Supabase deadline
    function updateCATimer() {
      const remaining = Math.max(
        0,
        Math.ceil((window.currentCATDeadline - Date.now()) / 1000),
      );

      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;

      timerDisplay.textContent =
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0");

      if (remaining <= 0) {
        clearInterval(window.catTimerInterval);
        timerDisplay.textContent = "Time is up!";
        submitButton.click();
      }
    }

    updateCATimer();
    window.catTimerInterval = setInterval(updateCATimer, 1000);

    submitButton.disabled = false;
    examArea.scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    console.error("Could not start CAT:", error);

    questionsContainer.textContent =
      error.message || "Unable to start this CAT.";

    submitButton.disabled = true;
  }
}
/* -------- SUBMIT CAT ANSWERS -------- */
async function submitCAT(event) {
  event.preventDefault();

  const submitButton = document.getElementById("submit-cat-button");
  const questions = window.currentCATQuestions || [];
  const catId = window.currentCATId;

  if (!catId || questions.length === 0) {
    alert("Please start a CAT first.");
    return;
  }

  const answers = {};

  for (const question of questions) {
    const selected = document.querySelector(
      'input[name="question-' + question.id + '"]:checked',
    );

    answers[question.id] = selected ? selected.value : "";
  }

  submitButton.disabled = true;
  submitButton.textContent = "Submitting...";

  try {
    const { data, error } = await window.supabaseClient.rpc(
      "submit_cat_attempt",
      {
        p_cat_id: catId,
        p_answers: answers,
      },
    );

    if (error) throw error;

    clearInterval(window.catTimerInterval);

    document.getElementById("cat-questions-container").textContent =
      "Your CAT has been submitted successfully.";

    document.getElementById("cat-timer").textContent = "Submitted";

    document.getElementById("exam-instructions").textContent =
      "Your result: " +
      data.score +
      " / " +
      data.total_questions +
      " (" +
      data.percentage +
      "%)";

    document.getElementById("cat-exam-form").reset();

    window.currentCATId = null;
    window.currentCATQuestions = [];
  } catch (error) {
    console.error("CAT submission failed:", error);

    alert(error.message || "Unable to submit your CAT. Please try again.");

    submitButton.disabled = false;
    submitButton.textContent = "Submit CAT";
  }
}
// Connect CAT submission form
const catExamForm = document.getElementById("cat-exam-form");

if (catExamForm) {
  catExamForm.addEventListener("submit", submitCAT);
}
/* -------- LOAD STUDENT CAT RESULTS -------- */
async function loadStudentResults() {
  const resultsContent = document.getElementById("student-results-content");

  if (!resultsContent) return;

  resultsContent.textContent = "Loading your results...";

  try {
    const { data, error } = await window.supabaseClient
      .from("cat_attempts")
      .select(
        `
        id,
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

    if (error) throw error;
    // Calculate student performance statistics
    const completedCATs = data ? data.length : 0;

    const totalPercentage = (data || []).reduce(function (total, result) {
      if (result.total_questions > 0) {
        return total + (result.score / result.total_questions) * 100;
      }
      return total;
    }, 0);

    const averageScore =
      completedCATs > 0 ? totalPercentage / completedCATs : 0;

    const highestScore = (data || []).reduce(function (highest, result) {
      if (result.total_questions > 0) {
        const percentage = (result.score / result.total_questions) * 100;
        return Math.max(highest, percentage);
      }
      return highest;
    }, 0);

    // Update the summary cards
    document.getElementById("completed-cats").textContent = completedCATs;
    document.getElementById("average-score").textContent =
      averageScore.toFixed(2) + "%";
    document.getElementById("highest-score").textContent =
      highestScore.toFixed(2) + "%";

    resultsContent.replaceChildren();

    if (!data || data.length === 0) {
      resultsContent.textContent = "You have no completed CATs yet.";
      return;
    }

    data.forEach(function (result) {
      const card = document.createElement("article");
      card.className = "cat-result-card";

      const title = document.createElement("h3");
      title.textContent = result.cats?.title || "CAT Assessment";

      const course = document.createElement("p");
      course.textContent = "Course: " + (result.cats?.course || "N/A");

      const marks = document.createElement("p");
      marks.textContent =
        "Score: " + result.score + " / " + result.total_questions;

      const percentage =
        result.total_questions > 0
          ? (result.score / result.total_questions) * 100
          : 0;

      const grade = document.createElement("p");
      grade.textContent = "Percentage: " + percentage.toFixed(2) + "%";

      // Determine the CAT grade
      let letterGrade;
      let classification;

      if (percentage >= 70) {
        letterGrade = "A";
        classification = "Excellent";
      } else if (percentage >= 60) {
        letterGrade = "B";
        classification = "Very Good";
      } else if (percentage >= 50) {
        letterGrade = "C";
        classification = "Good";
      } else if (percentage >= 40) {
        letterGrade = "D";
        classification = "Pass";
      } else {
        letterGrade = "E";
        classification = "Needs Improvement";
      }

      const gradeClassification = document.createElement("p");
      gradeClassification.textContent =
        "Grade: " + letterGrade + " — " + classification;
      const date = document.createElement("p");
      date.textContent =
        "Submitted: " + new Date(result.submitted_at).toLocaleString();

      card.append(title, course, marks, grade, gradeClassification, date);
      resultsContent.appendChild(card);
    });
  } catch (error) {
    console.error("Could not load CAT results:", error);

    resultsContent.textContent =
      "Unable to load your results. Please try again.";
  }
}
/* -------- INITIALIZE STUDENT CATS AND RESULTS -------- */
if (document.getElementById("cats-content")) {
  loadStudentCATs();
  loadStudentResults();
}
