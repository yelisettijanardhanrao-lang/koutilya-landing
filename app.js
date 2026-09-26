// =====================================================
// DOWNLOAD PDF - SUBSCRIPTION GATE
// =====================================================

const downloadLanguage = document.getElementById('downloadLanguage');
const downloadBtn = document.getElementById('downloadBtn');

if (downloadBtn && downloadLanguage) {

  downloadBtn.addEventListener('click', function () {

    const lang = downloadLanguage.value;

    if (!lang) {
      alert('Please select a language first.');
      return;
    }

    // IMPORTANT:
    // Do NOT send directly to /auth/youtube.
    // First open the subscription page.
    window.location.href =
      '/subscribe.html?lang=' + encodeURIComponent(lang);

  });

}
