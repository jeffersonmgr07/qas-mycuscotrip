document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("experienceForm");
  const list = document.getElementById("experienceList");

  loadExperiences();

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const experiences = JSON.parse(localStorage.getItem("experiences") || "[]");

    const newExp = {
      id: "exp_" + Date.now(),
      title: document.getElementById("title").value,
      slug: document.getElementById("slug").value,
      basePricing: {
        adult: Number(document.getElementById("price").value)
      },
      capacity: Number(document.getElementById("capacity").value),
      status: "published"
    };

    experiences.push(newExp);
    localStorage.setItem("experiences", JSON.stringify(experiences));

    form.reset();
    loadExperiences();
  });

  function loadExperiences() {
    const experiences = JSON.parse(localStorage.getItem("experiences") || "[]");

    list.innerHTML = experiences
      .map(exp => `<li>${exp.title} - ${exp.basePricing.adult} USD</li>`)
      .join("");
  }
});
