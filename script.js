const experienceData = [
  {
    role: "Release Engineer Intern",
    company: "FranConnect, India",
    period: "Jan 2026 - Present",
    duration: "Current role",
    summary:
      "Supporting release quality across franchise management workflows while keeping testing feedback clear, actionable, and business-aware.",
    points: [
      "Performed manual testing on operations, royalty, CRM, and reporting modules.",
      "Identified, logged, and tracked defects using bug tracking tools.",
      "Worked with developers and business analysts to clarify requirements and resolve issues.",
      "Contributed to stronger test coverage and fewer production defects."
    ],
    link: "https://drive.google.com/file/d/1ofsINGx9TTzcGP0T-PEBnEX8uRgdKeRh/view?usp=drive_link",
    linkLabel: "View internship proof"
  },
  {
    role: "Manual Testing Intern",
    company: "ABESIT, India",
    period: "Jun 2025 - Aug 2025",
    duration: "3-month internship",
    summary:
      "Worked across multiple software applications with manual and integration testing that emphasized reliability, usability, and disciplined test execution.",
    points: [
      "Performed manual and integration testing to validate functionality and usability.",
      "Designed and executed comprehensive test cases and documented defects for timely resolution.",
      "Validated bug fixes and retested impacted features to improve product reliability.",
      "Built strong practice in test planning, regression testing, defect tracking, and UI or UX validation."
    ],
    link: "https://drive.google.com/file/d/1ThCY1q6FvxqeokTwQzEa-kOdyotTHKaB/view?usp=drive_link",
    linkLabel: "View internship proof"
  },
  {
    role: "Python Intern",
    company: "Cloud Counselage Pvt. Ltd., India",
    period: "Oct 2024 - Nov 2024",
    duration: "2-month internship",
    summary:
      "Strengthened technical problem solving by building scripts and working with data pipelines that required precision, cleanup, and collaborative delivery.",
    points: [
      "Developed Python scripts based on project requirements.",
      "Handled data processing tasks using Pandas and NumPy for reading, cleaning, and analysis.",
      "Worked closely with developers, analysts, and managers to gather requirements and implement solutions.",
      "Participated in project discussions and progress reviews with the team."
    ]
  }
];

const skillData = {
  Languages: ["Java", "Python", "JavaScript (basic)", "SQL"],
  Tools: ["Git", "GitHub", "VS Code", "IntelliJ", "Eclipse", "Power BI", "MySQL"],
  "Testing skills": ["Manual testing", "Functional", "Regression", "Smoke", "Integration", "UI testing", "API testing"],
  Process: ["SDLC", "STLC", "Test case design", "Bug reporting", "Agile", "Scrum", "V-Model", "Sprint planning", "Jira"],
  Strengths: ["Problem solving", "Attention to detail", "Time management", "Team collaboration", "Clear documentation"]
};

const experienceNav = document.getElementById("experience-nav");
const experiencePanel = document.getElementById("experience-panel");
const skillSwitcher = document.getElementById("skill-switcher");
const skillGrid = document.getElementById("skill-grid");
const skillPanelLabel = document.getElementById("skill-panel-label");
const copyEmailButton = document.getElementById("copy-email");

function renderExperience(selectedIndex) {
  if (!experienceNav || !experiencePanel) return;

  experienceNav.innerHTML = "";

  experienceData.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `experience-button${index === selectedIndex ? " is-active" : ""}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", index === selectedIndex ? "true" : "false");
    button.innerHTML = `
      <strong>${item.role}</strong>
      <span>${item.company}</span>
      <span>${item.period}</span>
    `;
    button.addEventListener("click", () => renderExperience(index));
    experienceNav.appendChild(button);
  });

  const current = experienceData[selectedIndex];
  const points = current.points.map((point) => `<li>${point}</li>`).join("");
  const linkMarkup = current.link
    ? `<a class="role-link" href="${current.link}" target="_blank" rel="noreferrer">${current.linkLabel}</a>`
    : "";

  experiencePanel.innerHTML = `
    <p class="project-label">Role spotlight</p>
    <h3>${current.role}</h3>
    <div class="role-meta">
      <span>${current.company}</span>
      <span>${current.period}</span>
      <span>${current.duration}</span>
    </div>
    <p class="role-summary">${current.summary}</p>
    <ul class="role-points">${points}</ul>
    ${linkMarkup}
  `;
}

function renderSkills(activeCategory) {
  if (!skillSwitcher || !skillGrid || !skillPanelLabel) return;

  skillSwitcher.innerHTML = "";

  Object.keys(skillData).forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `skill-toggle${category === activeCategory ? " is-active" : ""}`;
    button.innerHTML = `
      <strong>${category}</strong>
      <span>${skillData[category].length} focus areas</span>
    `;
    button.addEventListener("click", () => renderSkills(category));
    skillSwitcher.appendChild(button);
  });

  skillPanelLabel.textContent = activeCategory;
  skillGrid.innerHTML = "";

  skillData[activeCategory].forEach((skill) => {
    const pill = document.createElement("span");
    pill.className = "skill-pill";
    pill.textContent = skill;
    skillGrid.appendChild(pill);
  });
}

function setCurrentYear() {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
}

function setupRevealObserver() {
  const revealNodes = document.querySelectorAll("[data-reveal]");
  if (!revealNodes.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18 }
  );

  revealNodes.forEach((node) => observer.observe(node));
}

function setupMetricCounters() {
  const metrics = document.querySelectorAll("[data-count]");
  if (!metrics.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const node = entry.target;
        const targetValue = Number(node.getAttribute("data-count"));
        const duration = 1200;
        const start = performance.now();

        function step(now) {
          const progress = Math.min((now - start) / duration, 1);
          const value = Math.floor(progress * targetValue);
          node.textContent = `${value}+`;
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            node.textContent = `${targetValue}+`;
          }
        }

        requestAnimationFrame(step);
        observer.unobserve(node);
      });
    },
    { threshold: 0.7 }
  );

  metrics.forEach((metric) => observer.observe(metric));
}

function setupSpotlight() {
  const root = document.documentElement;
  window.addEventListener("pointermove", (event) => {
    root.style.setProperty("--spot-x", `${event.clientX}px`);
    root.style.setProperty("--spot-y", `${event.clientY}px`);
  });
}

function setupActiveNav() {
  const sections = document.querySelectorAll("main section[id]");
  const navLinks = Array.from(document.querySelectorAll(".site-nav a"));
  if (!sections.length || !navLinks.length) return;

  const linkMap = new Map(navLinks.map((link) => [link.getAttribute("href"), link]));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => link.classList.remove("is-current"));
        const active = linkMap.get(`#${entry.target.id}`);
        if (active) active.classList.add("is-current");
      });
    },
    {
      rootMargin: "-40% 0px -45% 0px",
      threshold: 0
    }
  );

  sections.forEach((section) => observer.observe(section));
}

function setupCopyEmail() {
  if (!copyEmailButton) return;

  copyEmailButton.addEventListener("click", async () => {
    const email = copyEmailButton.getAttribute("data-email");
    if (!email) return;

    try {
      await navigator.clipboard.writeText(email);
      copyEmailButton.textContent = "Email copied";
      window.setTimeout(() => {
        copyEmailButton.textContent = "Copy email";
      }, 1800);
    } catch (error) {
      copyEmailButton.textContent = "Copy failed";
      window.setTimeout(() => {
        copyEmailButton.textContent = "Copy email";
      }, 1800);
    }
  });
}

renderExperience(0);
renderSkills("Languages");
setCurrentYear();
setupRevealObserver();
setupMetricCounters();
setupSpotlight();
setupActiveNav();
setupCopyEmail();
