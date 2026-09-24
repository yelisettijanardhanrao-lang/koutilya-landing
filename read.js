(function () {
  const frame = document.getElementById("readerFrame");
  const empty = document.getElementById("readerEmpty");
  const buttons = document.querySelectorAll(".reader-lang");

  // PDFs are kept inside the server's private-pdfs folder and are
  // delivered through the protected /read-pdf/:lang route.
  const pdfs = {
    te: "/read-pdf/te",
    en: "/read-pdf/en",
    hi: "/read-pdf/hi",
    ta: "/read-pdf/ta",
    kn: "/read-pdf/kn"
  };

  function openLanguage(lang) {
    const pdfUrl = pdfs[lang];
    if (!pdfUrl) return;

    buttons.forEach(button => {
      button.classList.toggle("active", button.dataset.lang === lang);
    });

    empty.hidden = true;
    frame.hidden = false;
    frame.src = pdfUrl + "#page=1&zoom=page-width";
  }

  buttons.forEach(button => {
    button.disabled = false;
    button.addEventListener("click", () => openLanguage(button.dataset.lang));
  });

  // Keep the page in the language-selection state until the user clicks.
  frame.hidden = true;
  empty.hidden = false;
})();
