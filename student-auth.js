/* -------- STUDENT ACCESS PROTECTION -------- */

document.body.style.visibility = "hidden";

async function verifyStudentAccess() {
  try {
    // 1. Verify that a user is signed in
    const {
      data: { user },
      error: sessionError,
    } = await window.supabaseClient.auth.getUser();

    if (sessionError || !user) {
      window.location.replace("login.html");
      return;
    }

    // 2. Verify that the signed-in user is a student
    const { data: roleData, error: roleError } = await window.supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) throw roleError;

    if (!roleData || roleData.role !== "student") {
      await window.supabaseClient.auth.signOut();
      window.location.replace("login.html");
      return;
    }

    // 3. Find this student's unfinished CAT attempts
    const { data: attempts, error: attemptsError } = await window.supabaseClient
      .from("cat_attempts")
      .select("cat_id")
      .eq("student_id", user.id)
      .is("submitted_at", null);

    if (attemptsError) throw attemptsError;

    // 4. Check whether any unfinished attempt is still active or expired
    for (const attempt of attempts || []) {
      const { data: status, error: statusError } =
        await window.supabaseClient.rpc("get_active_cat_attempt", {
          p_cat_id: attempt.cat_id,
        });

      if (statusError) throw statusError;

      if (
        status &&
        (status.status === "active" || status.status === "expired")
      ) {
        // Keep the student on the CAT page until the attempt is resolved
        window.location.replace(
          `cat.html?cat=${encodeURIComponent(attempt.cat_id)}`,
        );
        return;
      }
    }

    // 5. No active CAT: allow access to the dashboard
    document.body.style.visibility = "visible";
  } catch (error) {
    console.error("Student access verification failed:", error);

    alert("Unable to verify student access. Please try again.");

    window.location.replace("login.html");
  }
}

verifyStudentAccess();
