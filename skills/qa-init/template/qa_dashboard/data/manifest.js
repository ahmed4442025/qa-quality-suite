/**
 * QA Dashboard - Modules Manifest
 * قائمة استدعاء موديولات الفحص المعتمدة
 */
[
  "data/temp.js"
].forEach(function (file) {
  document.write('<script src="' + file + '"><\/script>');
});
