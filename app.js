(function () {
  const downloadSelect = document.getElementById('downloadLanguage');
  const downloadBtn = document.getElementById('downloadBtn');
  if (!downloadSelect || !downloadBtn) return;

  downloadBtn.addEventListener('click', function () {
    const lang = downloadSelect.value;
    if (!lang) return alert('Please select a language first.');
    window.location.href = '/subscribe.html?lang=' + encodeURIComponent(lang);
  });
})();
