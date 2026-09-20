/**
 * QA Bug Tracker Data - Template / Sample Module
 * نموذج تجريبي استرشادي لهيكل وتفاصيل الفحص
 */
window.MODULE_TEMP = {
  moduleId: "sample_module",
  moduleName: "📦 Sample Module - نموذج توضيحي لمستوى التفاصيل",
  tasks: [
    {
      id: "SMP-01",
      title: "انهيار التطبيق فوراً عند فتح جرد العهدة بسبب كسر عشري بالـ JSON (Fatal Crash on Double Parsing)",
      types: ["bug"],
      severity: "Critical",
      file: "agent_inventory_today_response.dart:66",
      culprit: "Mobile",
      requiresBackend: false,
      status: "pending",
      testScenario: "1. تسجيل الدخول بحساب مستخدم يمتلك مبالغ أو نسب بكسور عشرية (مثال: عهدة بقيمة 1,520.75 ريال أو نسبة 45.5%).\n2. النقر على شاشة 'جرد العهدة' لتحميل بيانات اليوم.\n3. الخروج المفاجئ والانهيار الفوري للتطبيق (Fatal Crash).\n\n💥 المخاطر:\nيقف المندوب صباحاً أمام مخزن الشركة لتحميل السيارة ومطابقة البضاعة قبل الانطلاق، وبمجرد فتح الشاشة ينهار التطبيق في وجهه ويتعذر عليه تسجيل الاستلام أو فتح الفواتير، مما يعطل خروجه لخط السير ويفوّت مواعيد تسليم البضائع للعملاء ويسبب خسارة تشغيلية وغضب أصحاب المتاجر.",
      technicalAnalysis: "يقوم كود دارت بعمل Type Casting غير آمن (`as int`) على حقول قد تعود كـ `double` من خادم الـ API عند وجود كسور، مما يطلق استثناء صريحاً يوقف التطبيق بالكامل: `type 'double' is not a subtype of type 'int?' in type cast`.",
      solution: "استخدام `num?` والتحويل الآمن للأرقام العشرية:\n```dart\n// agent_inventory_today_response.dart\ncustodyValue = (json['custody_value'] as num?)?.toDouble();\nsoldPercentage = (json['sold_percentage'] as num?)?.toDouble();\n```"
    }
  ]
};
