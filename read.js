(function () {
  const frame = document.getElementById("readerFrame");
  const empty = document.getElementById("readerEmpty");
  const buttons = document.querySelectorAll(".reader-lang");
  const pdfs = { te: "/read-pdf/te" };
  function openLanguage(lang) {
    buttons.forEach(b => b.classList.toggle("active", b.dataset.lang === lang));
    if (!pdfs[lang]) return alert("This language edition is coming soon.");
    frame.src = pdfs[lang] + "#page=1&zoom=page-width";
    frame.hidden = false;
    empty.hidden = true;
  }
  buttons.forEach(button => button.addEventListener("click", () => openLanguage(button.dataset.lang)));
  openLanguage("te");
})();
