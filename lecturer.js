/* -------- LECTURER ACCESS PROTECTION -------- */

document.body.style.visibility = "hidden";

async function verifyLecturerAccess() {
  try {
    const {
      data: { user },
      error: sessionError,
    } = await window.supabaseClient.auth.getUser();

    if (sessionError || !user) {
      window.location.replace("login.html");
      return false;
    }

    const { data: roleData, error: roleError } = await window.supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) throw roleError;

    if (!roleData || roleData.role !== "lecturer") {
      await window.supabaseClient.auth.signOut();
      window.location.replace("login.html");
      return false;
    }

    document.body.style.visibility = "visible";
    return true;
  } catch (error) {
    console.error("Lecturer access verification failed:", error);
    alert("Unable to verify lecturer access. Please try again.");
    window.location.replace("login.html");
    return false;
  }
}

verifyLecturerAccess();

async function testSupabaseDatabase() {
  const { data, error } = await supabaseClient
    .from("learning_materials")
    .select("id")
    .limit(1);

  if (error) {
    console.error("Database test failed:", error.message);
    return;
  }

  console.log("Database connection successful!");
  console.log("Materials found:", data.length);
}

testSupabaseDatabase();

const catForm = document.getElementById("cat-creation-form");
const createdCatDetails = document.getElementById("created-cat-details");
const catFormMessage = document.getElementById("cat-form-message");

const materialForm = document.getElementById("material-creation-form");
const materialFormMessage = document.getElementById("material-form-message");
const lecturerMaterialsList = document.getElementById(
  "lecturer-materials-list",
);
const materialFileInput = document.getElementById("material-file");

let learningMaterials = [];

const questionForm = document.getElementById("question-creation-form");
const questionCATSelect = document.getElementById("question-cat");
const questionFormMessage = document.getElementById("question-form-message");
const createdQuestions = document.getElementById("created-questions");
const filterQuestionsCAT = document.getElementById("filter-questions-cat");
const cancelEditButton = document.getElementById("cancel-edit-btn");
// Declare both data collections before using them.
let catAssessments = [];
let catQuestions = {};
let editingQuestionId = null;
let editingCATId = null;

// -------------------- LEARNING MATERIALS --------------------

function saveLearningMaterials() {
  localStorage.setItem(
    "btuLearningMaterials",
    JSON.stringify(learningMaterials),
  );
}

function loadLearningMaterials() {
  try {
    const saved = localStorage.getItem("btuLearningMaterials");
    const parsed = saved ? JSON.parse(saved) : [];

    learningMaterials = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    learningMaterials = [];
    console.error("Could not load learning materials:", error);
  }
}

function renderLearningMaterials() {
  lecturerMaterialsList.replaceChildren();

  if (learningMaterials.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-state";
    emptyMessage.textContent = "No learning materials have been added yet.";

    lecturerMaterialsList.appendChild(emptyMessage);
    return;
  }

  learningMaterials.forEach(function (material) {
    const card = document.createElement("div");
    card.className = "created-cat-card";

    const title = document.createElement("h3");
    title.textContent = material.title;

    const course = document.createElement("p");
    course.textContent = "Course: " + material.course;

    const description = document.createElement("p");
    description.textContent = "Description: " + material.description;

    card.append(title, course, description);

    if (material.external_link) {
      const link = document.createElement("a");
      link.href = material.external_link;
      link.textContent = "Open External Material";
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      card.appendChild(link);
    }

    if (material.file_path) {
      const fileName = material.file_path.split("/").pop();

      const fileInfo = document.createElement("p");
      fileInfo.textContent = "Uploaded file: " + fileName;

      const downloadButton = document.createElement("button");
      downloadButton.type = "button";
      downloadButton.textContent = "Open / Download Material";
      downloadButton.className = "login-button";

      downloadButton.addEventListener("click", async function () {
        downloadButton.disabled = true;
        downloadButton.textContent = "Preparing download...";

        try {
          const { data, error } = await supabaseClient.storage
            .from("learning-materials")
            .createSignedUrl(material.file_path, 600);

          if (error) {
            throw error;
          }

          window.open(data.signedUrl, "_blank", "noopener,noreferrer");
        } catch (error) {
          console.error("Download link creation failed:", error);
          alert("Could not open the material. Please sign in and try again.");
        } finally {
          downloadButton.disabled = false;
          downloadButton.textContent = "Open / Download Material";
        }
      });

      card.append(fileInfo, downloadButton);
    }

    lecturerMaterialsList.appendChild(card);
  });
}

// -------------------- CAT STORAGE --------------------

function saveCATs() {
  localStorage.setItem("btuCatAssessments", JSON.stringify(catAssessments));
}

async function loadCATs() {
  try {
    const { data, error } = await window.supabaseClient
      .from("cats")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    catAssessments = Array.isArray(data) ? data : [];

    renderCATCards();
    populateCATSelector();
    populateQuestionFilter();
    populateLecturerPerformanceSelector();
  } catch (error) {
    catAssessments = [];
    console.error("Could not load CATs:", error);
    catFormMessage.textContent = "Unable to load CATs.";
  }
}

// -------------------- QUESTION STORAGE --------------------

function saveCATQuestions() {
  localStorage.setItem("btuCatQuestions", JSON.stringify(catQuestions));
}
async function deleteQuestion(questionId, catId) {
  const cat = catAssessments.find(function (item) {
    return String(item.id) === String(catId);
  });

  if (!cat) {
    return;
  }

  try {
    const { error } = await window.supabaseClient
      .from("cat_questions")
      .delete()
      .eq("id", questionId)
      .eq("cat_id", catId);

    if (error) throw error;

    catQuestions[catId] = (catQuestions[catId] || []).filter(
      function (question) {
        return String(question.id) !== String(questionId);
      },
    );

    renderCATCards();
    displayAllSavedQuestions();

    questionFormMessage.textContent = "Question deleted successfully.";
  } catch (error) {
    console.error("Question deletion failed:", error);
    questionFormMessage.textContent =
      "Error: " + (error.message || "Unable to delete question.");
  }
}
async function loadCATQuestions() {
  try {
    const { data, error } = await window.supabaseClient
      .from("cat_questions")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;

    catQuestions = {};

    data.forEach(function (question) {
      const catId = question.cat_id;

      if (!Array.isArray(catQuestions[catId])) {
        catQuestions[catId] = [];
      }

      catQuestions[catId].push({
        id: question.id,
        question: question.question,
        options: {
          A: question.option_a,
          B: question.option_b,
          C: question.option_c,
          D: question.option_d,
        },
        correctAnswer: question.correct_answer,
      });
    });

    displayAllSavedQuestions();
  } catch (error) {
    catQuestions = {};
    console.error("Could not load questions:", error);
    questionFormMessage.textContent = "Unable to load saved questions.";
  }
}

// -------------------- DISPLAY CAT CARDS --------------------

function displayCAT(cat) {
  const card = document.createElement("div");
  card.className = "created-cat-card";

  const heading = document.createElement("h3");
  heading.textContent = cat.title;

  const questionCount = document.createElement("p");
  const questions = catQuestions[String(cat.id)] || [];
  questionCount.textContent = "Questions: " + questions.length;

  const courseText = document.createElement("p");
  courseText.textContent = "Course: " + cat.course;

  const instructionsText = document.createElement("p");
  instructionsText.textContent = "Instructions: " + cat.instructions;

  const durationText = document.createElement("p");
  durationText.className = "cat-duration";
  durationText.textContent = "Duration: " + cat.duration + " minutes";

  // Publication status
  const statusText = document.createElement("p");
  statusText.textContent = cat.is_published
    ? "Status: Published"
    : "Status: Unpublished";

  // Publish / Unpublish button
  const publishButton = document.createElement("button");
  publishButton.type = "button";
  publishButton.textContent = cat.is_published
    ? "Unpublish CAT"
    : "Publish CAT";

  publishButton.addEventListener("click", async function () {
    publishButton.disabled = true;
    publishButton.textContent = "Updating...";

    try {
      const newStatus = !cat.is_published;

      const { error } = await window.supabaseClient
        .from("cats")
        .update({ is_published: newStatus })
        .eq("id", cat.id);

      if (error) throw error;

      cat.is_published = newStatus;

      statusText.textContent = newStatus
        ? "Status: Published"
        : "Status: Unpublished";

      publishButton.textContent = newStatus ? "Unpublish CAT" : "Publish CAT";
    } catch (error) {
      console.error("CAT publication update failed:", error);
      alert("Unable to update CAT publication status.");
      publishButton.textContent = cat.is_published
        ? "Unpublish CAT"
        : "Publish CAT";
    } finally {
      publishButton.disabled = false;
    }
  });

  card.append(
    heading,
    questionCount,
    courseText,
    instructionsText,
    durationText,
    statusText,
    publishButton,
  );

  createdCatDetails.appendChild(card);
}

function renderCATCards() {
  createdCatDetails.replaceChildren();
  catAssessments.forEach(displayCAT);
}

// -------------------- POPULATE CAT SELECTOR --------------------

function populateCATSelector() {
  questionCATSelect.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a CAT";
  questionCATSelect.appendChild(placeholder);

  catAssessments.forEach(function (cat) {
    const option = document.createElement("option");
    option.value = String(cat.id);
    option.textContent = cat.title + " — " + cat.course;
    questionCATSelect.appendChild(option);
  });
}
function populateLecturerPerformanceSelector() {
  const select = document.getElementById("lecturer-performance-cat");

  if (!select) return;

  select.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a CAT";
  select.appendChild(placeholder);

  catAssessments.forEach(function (cat) {
    const option = document.createElement("option");
    option.value = String(cat.id);
    option.textContent = cat.title + " — " + cat.course;
    select.appendChild(option);
  });
}
const performanceCATSelect = document.getElementById(
  "lecturer-performance-cat",
);

if (performanceCATSelect) {
  performanceCATSelect.addEventListener("change", function () {
    const selectedCATId = this.value;

    if (!selectedCATId) {
      document.getElementById("lecturer-cat-results").textContent =
        "Select a CAT to view student performance.";

      document.getElementById("lecturer-total-attempts").textContent = "0";
      document.getElementById("lecturer-average-score").textContent = "0%";
      document.getElementById("lecturer-highest-score").textContent = "0%";
      document.getElementById("lecturer-lowest-score").textContent = "0%";

      return;
    }

    loadLecturerCATPerformance(selectedCATId);
  });
}

async function loadLecturerCATPerformance(catId) {
  const resultsContainer = document.getElementById("lecturer-cat-results");

  if (!resultsContainer) return;

  resultsContainer.textContent = "Loading student results...";

  try {
    const { data, error } = await window.supabaseClient.rpc(
      "get_lecturer_cat_performance",
      { p_cat_id: catId },
    );

    if (error) throw error;

    const results = Array.isArray(data) ? data : [];

    const percentages = results.map(function (result) {
      return result.total_questions > 0
        ? (result.score / result.total_questions) * 100
        : 0;
    });

    const totalAttempts = results.length;

    const average = totalAttempts
      ? percentages.reduce((sum, value) => sum + value, 0) / totalAttempts
      : 0;

    const highest = totalAttempts ? Math.max(...percentages) : 0;
    const lowest = totalAttempts ? Math.min(...percentages) : 0;

    document.getElementById("lecturer-total-attempts").textContent =
      totalAttempts;

    document.getElementById("lecturer-average-score").textContent =
      average.toFixed(2) + "%";

    document.getElementById("lecturer-highest-score").textContent =
      highest.toFixed(2) + "%";

    document.getElementById("lecturer-lowest-score").textContent =
      lowest.toFixed(2) + "%";

    resultsContainer.replaceChildren();

    if (results.length === 0) {
      resultsContainer.textContent = "No students have submitted this CAT yet.";
      return;
    }

    results.forEach(function (result, index) {
      const card = document.createElement("div");
      card.className = "cat-result-card";

      const student = document.createElement("h4");
      student.textContent = result.student_email || "Student " + (index + 1);

      const marks = document.createElement("p");
      marks.textContent =
        "Marks: " + result.score + " / " + result.total_questions;

      const percentage = document.createElement("p");
      percentage.textContent =
        "Percentage: " + percentages[index].toFixed(2) + "%";

      const date = document.createElement("p");
      date.textContent =
        "Submitted: " + new Date(result.submitted_at).toLocaleString();

      card.append(student, marks, percentage, date);
      resultsContainer.appendChild(card);
    });
  } catch (error) {
    console.error("Could not load CAT performance:", error);
    resultsContainer.textContent =
      "Unable to load CAT performance. Please try again.";
  }
}

function populateQuestionFilter() {
  filterQuestionsCAT.replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All CATs";
  filterQuestionsCAT.appendChild(allOption);

  catAssessments.forEach(function (cat) {
    const option = document.createElement("option");
    option.value = String(cat.id);
    option.textContent = cat.title + " — " + cat.course;
    filterQuestionsCAT.appendChild(option);
  });
}

// -------------------- DISPLAY QUESTIONS --------------------
function editQuestion(questionId, catId) {
  const cat = catAssessments.find(function (item) {
    return String(item.id) === String(catId);
  });

  if (!cat) {
    return;
  }

  const questions = catQuestions[String(catId)] || [];

  const question = questions.find(function (item) {
    return String(item.id) === String(questionId);
  });

  if (!question) {
    return;
  }

  questionCATSelect.value = String(catId);
  document.getElementById("question-text").value = question.question;
  document.getElementById("option-a").value = question.options.A;
  document.getElementById("option-b").value = question.options.B;
  document.getElementById("option-c").value = question.options.C;
  document.getElementById("option-d").value = question.options.D;
  document.getElementById("correct-answer").value = question.correctAnswer;

  editingQuestionId = question.id;
  editingCATId = String(catId);
  cancelEditButton.hidden = false;

  questionFormMessage.textContent =
    "Editing question. Make your changes in the form below.";

  questionForm.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function displayQuestion(question, catTitle, catId) {
  const card = document.createElement("div");
  card.className = "created-cat-card";

  const catLabel = document.createElement("p");
  catLabel.textContent = "Assessment: " + catTitle;

  const heading = document.createElement("h3");
  heading.textContent = question.question;

  const answersList = document.createElement("ul");

  Object.entries(question.options).forEach(function ([letter, answer]) {
    const item = document.createElement("li");
    item.textContent = letter + ". " + answer;
    answersList.appendChild(item);
  });

  const deleteButton = document.createElement("button");
  deleteButton.textContent = "Delete Question";
  deleteButton.type = "button";
  deleteButton.className = "delete-question-btn";

  deleteButton.addEventListener("click", function () {
    const confirmed = confirm("Are you sure you want to delete this question?");

    if (!confirmed) {
      return;
    }

    deleteQuestion(question.id, catId);
  });

  const editButton = document.createElement("button");
  editButton.textContent = "Edit Question";
  editButton.type = "button";
  editButton.className = "edit-question-btn";

  editButton.addEventListener("click", function () {
    editQuestion(question.id, catId);
  });

  card.append(catLabel, heading, answersList, editButton, deleteButton);
  createdQuestions.appendChild(card);
}

function displayAllSavedQuestions() {
  createdQuestions.replaceChildren();

  const selectedCatId = filterQuestionsCAT.value;

  Object.entries(catQuestions).forEach(function ([catId, questions]) {
    if (selectedCatId && String(catId) !== selectedCatId) {
      return;
    }

    const cat = catAssessments.find(function (item) {
      return String(item.id) === String(catId);
    });

    questions.forEach(function (question) {
      displayQuestion(question, cat ? cat.title : "Unknown CAT", catId);
    });
  });
}

filterQuestionsCAT.addEventListener("change", displayAllSavedQuestions);

// -------------------- CREATE A CAT --------------------
catForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const title = document.getElementById("cat-title").value.trim();
  const course = document.getElementById("course-name").value.trim();
  const instructions = document.getElementById("cat-instructions").value.trim();
  const duration = document.getElementById("cat-duration").value;

  if (
    !title ||
    !course ||
    !instructions ||
    !duration ||
    !Number.isFinite(Number(duration)) ||
    Number(duration) < 1
  ) {
    catFormMessage.textContent = "Please complete all fields correctly.";
    return;
  }

  catFormMessage.textContent = "Saving CAT...";

  try {
    // Get the currently signed-in lecturer
    const {
      data: { user },
      error: userError,
    } = await window.supabaseClient.auth.getUser();

    if (userError) throw userError;
    if (!user) throw new Error("Please sign in again.");

    // Save the CAT in Supabase
    const { data: savedCAT, error } = await window.supabaseClient
      .from("cats")
      .insert({
        title: title,
        course: course,
        instructions: instructions,
        duration: Number(duration),
        lecturer_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Add the saved CAT to the current dashboard
    catAssessments.push(savedCAT);

    renderCATCards();
    populateCATSelector();
    populateQuestionFilter();

    catFormMessage.textContent = "CAT created successfully.";
    catForm.reset();
  } catch (error) {
    console.error("CAT creation failed:", error);

    catFormMessage.textContent = "Error: " + (error.message || "Unknown error");
  }
});
// -------------------- LOAD MATERIALS FROM SUPABASE --------------------

async function loadLearningMaterialsFromSupabase() {
  const { data, error } = await supabaseClient
    .from("learning_materials")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Could not load learning materials:", error.message);

    materialFormMessage.textContent =
      "Could not load materials: " + error.message;

    return;
  }

  learningMaterials = data;
  renderLearningMaterials();
}

// -------------------- ADD LEARNING MATERIAL --------------------

materialForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const title = document.getElementById("material-title").value.trim();
  const course = document.getElementById("material-course").value.trim();
  const description = document
    .getElementById("material-description")
    .value.trim();
  const link = document.getElementById("material-link").value.trim();
  const selectedFile = materialFileInput.files[0];

  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ];

  if (!title || !course || !description) {
    materialFormMessage.textContent = "Please complete the required fields.";
    return;
  }

  if (!selectedFile && !link) {
    materialFormMessage.textContent =
      "Choose a file or provide an external material link.";
    return;
  }

  if (selectedFile && !allowedTypes.includes(selectedFile.type)) {
    materialFormMessage.textContent =
      "Please select a PDF, Word, or PowerPoint file.";
    return;
  }

  if (selectedFile && selectedFile.size > 10 * 1024 * 1024) {
    materialFormMessage.textContent = "The file must be 10 MB or smaller.";
    return;
  }

  const { data: sessionData, error: sessionError } =
    await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    materialFormMessage.textContent =
      "Please sign in before adding learning materials.";
    return;
  }

  const user = sessionData.session.user;
  let filePath = null;

  materialFormMessage.textContent = "Saving learning material...";

  try {
    if (selectedFile) {
      const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");

      filePath = user.id + "/" + Date.now() + "-" + safeFileName;

      const { error: uploadError } = await supabaseClient.storage
        .from("learning-materials")
        .upload(filePath, selectedFile, {
          contentType: selectedFile.type,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }
    }

    const { error: insertError } = await supabaseClient
      .from("learning_materials")
      .insert({
        title: title,
        course: course,
        description: description,
        file_path: filePath,
        external_link: link || null,
        uploaded_by: user.id,
      });

    if (insertError) {
      throw insertError;
    }

    materialFormMessage.textContent = "Learning material saved successfully.";
    materialForm.reset();

    await loadLearningMaterialsFromSupabase();
  } catch (error) {
    console.error("Learning material save failed:", error);
    materialFormMessage.textContent =
      "Could not save the material: " + error.message;
  }
});

// -------------------- ADD A QUESTION --------------------

questionForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const catId = questionCATSelect.value;
  const questionText = document.getElementById("question-text").value.trim();
  const optionA = document.getElementById("option-a").value.trim();
  const optionB = document.getElementById("option-b").value.trim();
  const optionC = document.getElementById("option-c").value.trim();
  const optionD = document.getElementById("option-d").value.trim();
  const correctAnswer = document.getElementById("correct-answer").value;

  const selectedCAT = catAssessments.find(function (cat) {
    return String(cat.id) === catId;
  });

  if (
    !selectedCAT ||
    !questionText ||
    !optionA ||
    !optionB ||
    !optionC ||
    !optionD ||
    !["A", "B", "C", "D"].includes(correctAnswer)
  ) {
    questionFormMessage.textContent =
      "Please complete every field and select a valid CAT.";
    return;
  }

  questionFormMessage.textContent = "Saving question...";

  try {
    const questionData = {
      cat_id: catId,
      question: questionText,
      option_a: optionA,
      option_b: optionB,
      option_c: optionC,
      option_d: optionD,
      correct_answer: correctAnswer,
    };

    let savedQuestion;

    // Update an existing question
    if (editingQuestionId !== null && editingCATId !== null) {
      const { data, error } = await window.supabaseClient
        .from("cat_questions")
        .update(questionData)
        .eq("id", editingQuestionId)
        .eq("cat_id", editingCATId)
        .select()
        .single();

      if (error) throw error;

      savedQuestion = data;
      questionFormMessage.textContent = "Question updated successfully.";

      editingQuestionId = null;
      editingCATId = null;
    } else {
      // Insert a new question
      const { data, error } = await window.supabaseClient
        .from("cat_questions")
        .insert(questionData)
        .select()
        .single();

      if (error) throw error;

      savedQuestion = data;
      questionFormMessage.textContent = "Question saved successfully.";
    }

    // Convert the database record to the format used by the dashboard
    const questionForDisplay = {
      id: savedQuestion.id,
      question: savedQuestion.question,
      options: {
        A: savedQuestion.option_a,
        B: savedQuestion.option_b,
        C: savedQuestion.option_c,
        D: savedQuestion.option_d,
      },
      correctAnswer: savedQuestion.correct_answer,
    };

    if (!Array.isArray(catQuestions[catId])) {
      catQuestions[catId] = [];
    }

    const existingIndex = catQuestions[catId].findIndex(function (question) {
      return question.id === savedQuestion.id;
    });

    if (existingIndex !== -1) {
      catQuestions[catId][existingIndex] = questionForDisplay;
    } else {
      catQuestions[catId].push(questionForDisplay);
    }

    renderCATCards();
    displayAllSavedQuestions();
    questionForm.reset();
    cancelEditButton.hidden = true;
  } catch (error) {
    console.error("CAT question save failed:", error);
    questionFormMessage.textContent =
      "Error: " + (error.message || "Unable to save question.");
  }
});

// -------------------- INITIAL PAGE LOAD --------------------

// Load all data before displaying anything.
async function initializeLecturerDashboard() {
  await loadCATs();
  await loadCATQuestions();
  await loadLearningMaterialsFromSupabase();
  await loadLecturerCATViolations();
}

initializeLecturerDashboard();

renderCATCards();
populateCATSelector();
populateQuestionFilter();
populateLecturerPerformanceSelector();
displayAllSavedQuestions();
cancelEditButton.addEventListener("click", function () {
  editingQuestionId = null;
  editingCATId = null;

  questionForm.reset();
  cancelEditButton.hidden = true;

  questionFormMessage.textContent = "Editing cancelled.";
});
/* -------- LECTURER SIGN OUT -------- */

const lecturerSignoutButton = document.getElementById("lecturer-signout-btn");

if (lecturerSignoutButton) {
  lecturerSignoutButton.addEventListener("click", async function () {
    lecturerSignoutButton.disabled = true;
    lecturerSignoutButton.textContent = "Signing out...";

    try {
      const { error } = await window.supabaseClient.auth.signOut();

      if (error) throw error;

      window.location.replace("login.html");
    } catch (error) {
      console.error("Lecturer sign out failed:", error);
      alert("Unable to sign out. Please try again.");

      lecturerSignoutButton.disabled = false;
      lecturerSignoutButton.textContent = "Sign Out";
    }
  });
} /* -------- LECTURER PROFILE -------- */

async function loadLecturerProfile() {
  const profileEmail = document.getElementById("lecturer-profile-email");
  const profileName = document.getElementById("lecturer-profile-name");
  const profileRole = document.getElementById("lecturer-profile-role");
  const profileInitial = document.getElementById("lecturer-profile-initial");
  const editButton = document.getElementById("edit-lecturer-profile-btn");

  // Only run when the lecturer profile exists
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
    profileRole.textContent = "Lecturer";

    profileInitial.textContent =
      fullName === "Not provided"
        ? (user.email || "L").charAt(0).toUpperCase()
        : fullName.charAt(0).toUpperCase();

    if (editButton) {
      editButton.addEventListener("click", async function () {
        const newName = prompt(
          "Enter your full name:",
          fullName === "Not provided" ? "" : fullName,
        );

        if (newName === null) return;

        if (!newName.trim()) {
          alert("Please enter your full name.");
          return;
        }

        editButton.disabled = true;
        editButton.textContent = "Saving...";

        try {
          const { error } = await window.supabaseClient.auth.updateUser({
            data: { full_name: newName.trim() },
          });

          if (error) throw error;

          profileName.textContent = newName.trim();
          profileInitial.textContent = newName.trim().charAt(0).toUpperCase();

          alert("Your profile has been updated successfully!");
        } catch (error) {
          console.error("Lecturer profile update failed:", error);
          alert("Could not update your profile. Please try again.");
        } finally {
          editButton.disabled = false;
          editButton.textContent = "Edit Profile";
        }
      });
    }
  } catch (error) {
    console.error("Lecturer profile loading failed:", error);
    profileEmail.textContent = "Unable to load profile";
  }
}

loadLecturerProfile();
/* -------- DASHBOARD STATISTICS -------- */

async function loadLecturerStatistics() {
  const totalMaterialsElement = document.getElementById("total-materials");
  const totalStudentsElement = document.getElementById("total-students");

  if (!totalMaterialsElement) return;

  try {
    const { count, error } = await window.supabaseClient
      .from("learning_materials")
      .select("*", { count: "exact", head: true });

    if (error) throw error;

    totalMaterialsElement.textContent = count ?? 0;
    const { data: studentCount, error: studentError } =
      await window.supabaseClient.rpc("get_student_count");

    if (studentError) throw studentError;

    totalStudentsElement.textContent = studentCount ?? 0;
  } catch (error) {
    console.error("Could not load material statistics:", error);
    totalMaterialsElement.textContent = "Error";
  }
}

loadLecturerStatistics();
async function loadLecturerCATViolations() {
  const message = document.getElementById("lecturer-violations-message");
  const list = document.getElementById("lecturer-violations-list");

  if (!message || !list) return;

  message.textContent = "Loading violation report...";
  list.innerHTML = "";

  try {
    const { data: violations, error } = await supabaseClient
      .from("cat_violations")
      .select(
        `
        id,
        cat_id,
        student_id,
        event_type,
        details,
        occurred_at,
        cats (
          title
        )
      `,
      )
      .order("occurred_at", { ascending: false });

    if (error) throw error;

    const records = violations || [];

    const total = records.length;
    const students = new Set(records.map((v) => v.student_id)).size;
    const tabSwitches = records.filter(
      (v) => v.event_type === "tab_switch",
    ).length;
    const fullscreenExits = records.filter(
      (v) => v.event_type === "fullscreen_exit",
    ).length;

    document.getElementById("lecturer-total-violations").textContent = total;
    document.getElementById("lecturer-affected-students").textContent =
      students;
    document.getElementById("lecturer-tab-switches").textContent = tabSwitches;
    document.getElementById("lecturer-fullscreen-exits").textContent =
      fullscreenExits;

    if (records.length === 0) {
      message.textContent = "No CAT violations have been recorded.";
      return;
    }

    message.textContent = `${total} violation(s) recorded.`;

    list.innerHTML = records
      .map(
        (violation) => `
      <div class="results-summary-card">
        <h4>${violation.cats?.title || "CAT assessment"}</h4>
        <p><strong>Event:</strong> ${violation.event_type.replaceAll("_", " ")}</p>
        <p><strong>Student ID:</strong> ${violation.student_id}</p>
        <p><strong>Time:</strong> ${new Date(violation.occurred_at).toLocaleString()}</p>
        <p><strong>Details:</strong> ${
          violation.details?.message || "No additional details"
        }</p>
      </div>
    `,
      )
      .join("");
  } catch (error) {
    console.error("Could not load CAT violations:", error);
    message.textContent = "Unable to load the violation report.";
  }
}
