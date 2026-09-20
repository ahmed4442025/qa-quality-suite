---
name: qa-init
description: Init QA (/qa-init)
---

# تهيئة بيئة تدقيق الجودة (`/qa-init`)

يقوم بتهيئة لوحة متابعة الجودة للمطورين داخل `./qa_dashboard`، وتقرير العميل المستقل داخل `./qa_report`، وفحص هيكل المشروع لإنشاء قائمة الموديولات في `qa_dashboard/modules.md` وملف التتبع `qa_dashboard/done.md`.

---

## خطوات العمل (Workflow Steps):

### 1. استخراج اسم المشروع ونسخ لوحة المطورين (`qa_dashboard`):
- استخرج اسم المشروع تلقائياً من ملف `pubspec.yaml` (حقل `name:`) أو `package.json` أو من اسم مجلد المشروع الرئيسي.
- انسخ مجلد `template/qa_dashboard` (المجاور لملف `SKILL.md` هذا) إلى مسار `./qa_dashboard` في المشروع (يحتوي على: `index.html`, `run.bat`, `server.ps1`, `js/app.js`, `data/manifest.js`, و `data/temp.js`).
- استبدل `{{PROJECT_NAME}}` داخل `qa_dashboard/index.html` باسم المشروع الفعلي في كل من وسم `<title>` والبادج في العنوان الرئيسي.

### 2. نسخ تقرير العميل المستقل (`qa_report`):
- انسخ مجلد `template/qa_report` (المجاور لملف `SKILL.md` هذا) إلى مسار `./qa_report` في المشروع.
- استبدل `{{PROJECT_NAME}}` داخل `qa_report/index.html` باسم المشروع الفعلي في وسم `<title>` وعنوان التقرير.

### 3. فحص المشروع وتوليد ملف `qa_dashboard/modules.md`:
قم بفحص هيكل ملفات ومجلدات المشروع (مثل `lib/modules/`, `lib/features/`, ملفات الـ Routes والـ Core) لاستخراج قائمة كاملة بكافة الموديولات، ثم اكتبها داخل ملف `qa_dashboard/modules.md` (داخل مجلد الداشبورد) طبقاً للبرومبت والمعايير التالية:

> **معايير استخراج وتوليد الموديولات:**
> - كتابة أسماء ونطاق كل موديول **باللغة الإنجليزية فقط**.
> - قائمة مرقمة تحت بعضها قابلة للنسخ بسهولة وبدون أي حشو إضافي.
> - وضع مربع اختيار `[ ]` قبل كل عنصر لتسهيل التتبع.
> 
> **الشكل المطلوب بالضبط داخل `qa_dashboard/modules.md`:**
> ```markdown
> # [Project Name] — Project Modules Checklist
> 
> 1. [ ] Core & Shared — Network (Dio/API), Error Handling, Local Storage & Cache
> 2. [ ] Splash & Onboarding — App Startup, Token Verification & Onboarding Flow
> 3. [ ] Authentication — Login, Registration, Password & Session Management
> 4. [ ] ...
> ```

### 4. إنشاء ملف `qa_dashboard/done.md`:
- أنشئ ملفاً جديداً فارغاً باسم `done.md` **داخل مجلد `qa_dashboard/`** ليكون مخصصاً لتسجيل المهام المنجزة تباعاً برقم الـ ID.

### 5. تقرير الانتهاء:
- أكد للمستخدم نجاح تهيئة مجلدي `./qa_dashboard` و `./qa_report`.
- أكد إنشاء ملفي `qa_dashboard/modules.md` (مع عرض القائمة المستخرجة) و `qa_dashboard/done.md`.
- أخبر المستخدم أنه يمكنه تشغيل لوحة المتابعة من التيرمينال عبر كتابة الأمر التالي (واكتبه له داخل كود بلوك مخصص لسهولة النسخ)، مع التوضيح أنه يمكن إيقاف السيرفر في أي وقت بالضغط على `Ctrl + C`:
  ```cmd
  .\qa_dashboard\run.bat
  ```
- وجه المستخدم لإمكانية فتح تقرير العميل مباشرة بالنقر على `qa_report/index.html`.
- اقترح البدء بفحص أول موديول عبر الأمر: `/qa-audit [Module Name]`.
