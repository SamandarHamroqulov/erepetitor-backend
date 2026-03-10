# eRepetitor Backend

## Texnologiyalar
- Node.js + Express
- Prisma ORM + PostgreSQL
- JWT (access/refresh token)
- nodemailer (email OTP)
- express-fileupload (avatar, billing proof)

## API endpointlar

### Auth  `/api/auth`
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/register` | Ro'yxatdan o'tish (OTP emailga yuboriladi) |
| POST | `/verify-otp` | OTP tasdiqlash (TRIAL subscription yaratiladi) |
| POST | `/resend-otp` | OTP qayta yuborish |
| POST | `/login` | Kirish |
| POST | `/refresh` | Access token yangilash |
| POST | `/logout` | Chiqish |
| POST | `/forgot-password` | Parolni tiklash (OTP) |
| POST | `/reset-password` | Yangi parol o'rnatish |

### Profile  `/api/profile`
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/me` | Profil ma'lumotlari |
| PATCH | `/me` | Profil yangilash |
| POST | `/change-password` | Parol o'zgartirish |
| POST | `/avatar` | Avatar yuklash |
| GET | `/billing/payments` | O'z to'lovlar tarixi |

### Billing  `/api/billing`
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/me` | Obuna holati + karta ma'lumotlari |
| GET | `/my-payments` | O'z to'lovlar |
| POST | `/create` | Yangi to'lov yaratish |
| POST | `/:id/proof` | Chek rasmini yuklash |
| GET | `/admin/pending` | ⚙️ Admin: kutayotgan to'lovlar |
| GET | `/admin/all` | ⚙️ Admin: barcha to'lovlar |
| POST | `/:id/confirm` | ⚙️ Admin: tasdiqlash |
| POST | `/:id/reject` | ⚙️ Admin: rad etish |

### Groups  `/api/groups`
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Guruhlar ro'yxati |
| POST | `/` | Guruh yaratish |
| GET | `/:id?date=YYYY-MM-DD` | Guruh detali + oylik to'lovlar |
| PATCH | `/:id` | Guruh yangilash |
| DELETE | `/:id` | Guruh o'chirish |

### Students  `/api/students`
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Barcha o'quvchilar |
| POST | `/` | O'quvchi qo'shish |
| GET | `/:id` | O'quvchi detali (6 oylik to'lovlar) |
| PATCH | `/:id` | O'quvchi yangilash |
| DELETE | `/:id` | O'quvchi o'chirish |
| PATCH | `/:id/transfer` | Boshqa guruhga o'tkazish |

### Payments  `/api/payments`
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/all?date=YYYY-MM-DD` | Barcha to'lovlar |
| GET | `/debtors?date=YYYY-MM-DD` | Qarzdorlar |
| GET | `/paid?date=YYYY-MM-DD` | To'langanlar |
| GET | `/export?date=YYYY-MM-DD` | Excel eksport |
| POST | `/create-month` | Guruhga oylik to'lovlar yaratish |
| POST | `/create-one` | Bitta o'quvchiga to'lov yaratish |
| PATCH | `/:id/pay` | To'landi |
| PATCH | `/:id/unpay` | Qaytarish |

### Dashboard  `/api/dashboard`
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/main?date=YYYY-MM-DD` | Asosiy dashboard |

### Next Lessons  `/api/next-lessons`
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/?limit=10` | Kelayotgan darslar |

### Group Schedules  `/api/group-schedules`
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/?groupId=1` | Jadvallar |
| POST | `/` | Jadval qo'shish |
| PATCH | `/:id/toggle` | Faollashtirish/o'chirish |
| DELETE | `/:id` | O'chirish |

## .env sozlamalari
```
BILLING_CARD_OWNER=To'liq ism
BILLING_CARD_NUMBER=8600XXXXXXXXXXXX
BILLING_BANK_NAME=Bank nomi
BILLING_MONTHLY_PRICE=100000
```

## Admin
Admin endpointlarini chaqirish uchun header qo'shing:
```
x-admin-token: <ADMIN_TOKEN>
```
