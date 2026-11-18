# School management system

A responsive Django school-management website for student records, academic
years, classes, subjects, enrollment, attendance, grades, and attendance
reporting.

## Setup

1. Create and activate a virtual environment:

   ```powershell
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

2. Install dependencies:

   ```powershell
   python -m pip install -r requirements.txt
   ```

3. Create a PostgreSQL database named `my_project`, then set the connection
   environment variables in PowerShell:

   ```powershell
   $env:POSTGRES_DB = "my_project"
   $env:POSTGRES_USER = "postgres"
   $env:POSTGRES_PASSWORD = "your-local-password"
   $env:POSTGRES_HOST = "localhost"
   $env:POSTGRES_PORT = "5432"
   ```

4. Create the tables, make the first administrator, and start the website:

   ```powershell
   python manage.py migrate
   python manage.py createsuperuser
   python manage.py runserver
   ```

Open `http://127.0.0.1:8000/` for the dashboard,
`http://127.0.0.1:8000/accounts/login/` to sign in, and
`http://127.0.0.1:8000/admin/` for school setup and account management.

## Initial school setup

Sign in as the superuser and use the admin site to:

1. Add an academic year and mark it current.
2. Add teachers, subjects, classes, and class-subject/teacher assignments.
3. Add guardian records and student records, then link guardians to students.
4. Open **Users** in the admin site to create accounts. Choose the school role
   on the user's inline profile while creating or editing the account:
   - **Office staff:** choose the office-staff role. The profile grants staff
     access to the management site.
   - **Teacher:** choose the teacher role and link the teacher record.
   - **Parent/guardian:** choose the parent role and link the guardian record.
   - **Student:** choose the student role and link the student record.
   - **Administrator:** use a Django superuser account; it does not need a
     school profile.
5. Create student enrollments for the academic year.

Office staff can manage records, enroll students, record attendance and grades,
and download the attendance CSV report. Teachers can record attendance and
grades for their assigned classes. Parent and student accounts see only the
linked student's current-year grades and attendance.

Attendance now supports QR-code check-in and check-out. Open **Students** and
print the active students' QR cards, then open **Attendance**, choose **Check
in** or **Check out**, and scan with the computer's webcam. The QR code contains
the student's number. Camera access requires browser media capture support
(`getUserMedia`) and a secure context (localhost or HTTPS). A bundled QR
decoder is used when the browser lacks native QR detection.
After updating an existing installation, run:

```powershell
python -m pip install -r requirements.txt
python manage.py migrate
```

### Test QR scanning from an iPhone on the same Wi-Fi

The iPhone camera requires HTTPS. Django's `runserver` is HTTP-only, so use a
local development certificate and Uvicorn for this test. Keep this development
server on a private network and use test data only.

1. Connect the PC and iPhone to the same Wi-Fi. Run `ipconfig` on the PC and
   note its Wi-Fi IPv4 address. Replace `172.20.10.2` below with that address
   if it is different.
2. Install [mkcert](https://github.com/FiloSottile/mkcert), then create a local
   certificate:

   ```powershell
   winget install FiloSottile.mkcert
   mkcert -install
   $certDir = Join-Path $env:LOCALAPPDATA "school-portal-dev"
   New-Item -ItemType Directory -Force $certDir | Out-Null
   mkcert -cert-file "$certDir\dev-cert.pem" -key-file "$certDir\dev-key.pem" 172.20.10.2 localhost 127.0.0.1
   mkcert -CAROOT
   ```

3. Transfer only `rootCA.pem` from the folder printed by `mkcert -CAROOT` to
   the iPhone. Install its profile, then enable full trust under **Settings >
   General > About > Certificate Trust Settings**. Never transfer
   `rootCA-key.pem`.
4. Update dependencies and apply migrations:

   ```powershell
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   .\.venv\Scripts\python.exe manage.py migrate
   ```

5. Stop `runserver` with **Ctrl+C**, then start the HTTPS server in PowerShell:

   ```powershell
   $certDir = Join-Path $env:LOCALAPPDATA "school-portal-dev"
   $env:DJANGO_ALLOWED_HOSTS = "localhost,127.0.0.1,172.20.10.2"
   .\.venv\Scripts\python.exe -m uvicorn my_project.asgi:application --host 0.0.0.0 --port 8000 --ssl-certfile "$certDir\dev-cert.pem" --ssl-keyfile "$certDir\dev-key.pem"
   ```

6. On the iPhone, open `https://172.20.10.2:8000/`, sign in, open
   **Attendance**, choose **Check in** or **Check out**, and tap **Start
   camera**. Allow camera access. If Windows Firewall prompts, allow access on
   private networks.

The QR scanner uses a bundled decoder for browsers without native QR detection.
The QR decoder is distributed under Apache License 2.0; see
`my_app/static/my_app/jsqr-LICENSE.txt`.

Fees and payments, timetables, and email/SMS delivery are not included yet.

Run the test suite with the included in-memory SQLite settings:

```powershell
python manage.py test --settings=my_project.test_settings
```

## Deployment

This project is deployed from the `main` branch of GitHub repository
`hutlongdy/bbu_django`. Vercel detects Django from `manage.py`, serves
collected static files from the CDN using `STATIC_ROOT`, and redeploys when
changes are pushed to `main`.

In the Vercel project's **Settings > Environment Variables**, configure:

- `DJANGO_SECRET_KEY` as a newly generated, private secret.
- `DJANGO_DEBUG` as `false`.
- `DJANGO_ALLOWED_HOSTS` as `bbu-django.vercel.app` plus any custom domains,
  comma-separated.
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, and
  `POSTGRES_PORT` with credentials for managed PostgreSQL. Never commit these
  values or use a local database in production.

Run database migrations against the production database after schema changes.
Use HTTPS and ensure the database provider allows connections from Vercel.
