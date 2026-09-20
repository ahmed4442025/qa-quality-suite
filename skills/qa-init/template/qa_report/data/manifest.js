/**
 * QA Report - Modules Manifest
 * قائمة استدعاء موديولات التقرير المعتمدة
 */
[
  "data/temp.js"
].forEach(function (file) {
  document.write('<script src="' + file + '"><\/script>');
});
