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
      testScenario: "1. افتح شاشة تسجيل الدخول.\n2. قم بإلغاء تفعيل خيار 'تذكرني' (Remember Me).\n3. أدخل بيانات الحساب واضغط تسجيل الدخول.\n4. بعد الدخول للشاشة الرئيسية، أغلق التطبيق كلياً من الـ Recent Apps / Task Manager.\n5. افتح التطبيق مرة أخرى.\n6. لاحظ تخطي شاشة الدخول وتسجيل الدخول تلقائياً، متجاهلاً رغبة المستخدم في عدم حفظ الجلسة الدائمة.\n\n💥 المخاطر:\nتجاوز إعدادات خصوصية وأمان المستخدم مما قد يعرض بيانات الحسابات الحساسة للاختراق على الأجهزة المشتركة."
    }
  ]
};
