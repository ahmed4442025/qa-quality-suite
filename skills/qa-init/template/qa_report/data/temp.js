/**
 * QA Bug Tracker Data - Sample Report Module
 */
window.MODULE_TEMP = {
  moduleId: "temp_module",
  moduleName: "تسجيل الدخول وإدارة الجلسة (Authentication & Session)",
  tasks: [
    {
      id: "AUTH-01",
      title: "خيار تذكرني (Remember Me) وهمي وحفظ الجلسة يتم دائماً في التخزين الدائم (Disk Cache)",
      types: ["bug", "security"],
      severity: "Critical",
      testScenario: "1. افتح شاشة تسجيل الدخول وألغِ تفعيل خيار 'تذكرني'.\n2. أدخل بيانات الحساب واضغط تسجيل الدخول.\n3. بعد ظهور الشاشة الرئيسية، أغلق التطبيق كلياً من قائمة التطبيقات الحديثة.\n4. افتح التطبيق مرة أخرى.\n\nالنتيجة الفعلية: يدخل التطبيق إلى الحساب تلقائياً.\nالنتيجة المتوقعة: تظهر شاشة تسجيل الدخول لأن خيار 'تذكرني' غير مفعّل."
    }
  ]
};
