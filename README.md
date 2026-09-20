# QA Quality Suite

مجموعة مترابطة لتشغيل دورة ضمان الجودة بالكامل: تهيئة لوحة المتابعة، تدقيق الموديولات، تدقيق Laravel، ثم حل المشاكل الموثقة.

## التثبيت لـ Codex

```bash
npx skills add YOUR_GITHUB_USER/qa-quality-suite --skill "*" --agent codex -g -y
```

استبدل `YOUR_GITHUB_USER` باسم حساب GitHub بعد رفع المستودع.

## الـ Skills المشمولة

- `qa-init` — يهيئ لوحة المتابعة والتقارير.
- `qa-audit` — يدقق موديولات تطبيقات الموبايل.
- `qa-audit-laravel` — يدقق موديولات Laravel.
- `qa-solve` — ينفذ إصلاحات المشاكل المسجلة في لوحة المتابعة.

## التسلسل المقترح

1. شغّل `/qa-init` مرة واحدة لكل مشروع.
2. شغّل `/qa-audit` أو `/qa-audit-laravel` للموديول المطلوب.
3. شغّل `/qa-solve` لمعالجة المعرفات المسجلة.

هذه Skills مصممة للتثبيت والاستخدام معًا.
