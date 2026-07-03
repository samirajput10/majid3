# Majid Steel Warehouse — Desktop App

Windows desktop version of the warehouse app. Runs **fully offline** with the
same interface, using its own private local database, and **syncs to MongoDB
Atlas automatically whenever the PC is online**.

## How it works

- The app bundles a local MongoDB (`mongod.exe`) and the Next.js server.
  Everything runs on your PC (`127.0.0.1`) — no internet needed to work.
- Your data lives in `%APPDATA%/majid-steel-desktop/mongo-data`.
- A background sync runs every few minutes:
  - **First run:** pulls all existing data down from Atlas.
  - **After that:** the PC is the source of truth — everything you add,
    edit, or delete is mirrored up to Atlas (so the website stays a live
    backup of the PC).
  - A fresh/empty install can never wipe Atlas (empty local DB never pushes).
- Sync status shows in the window title (`synced 12:30` / `offline — will
  sync when internet returns`).

> Because the PC is the source of truth, make your changes in the desktop
> app. Changes made on the website will be overwritten by the next sync.

## Building the installer

```bash
cd desktop
npm install            # once
cp default-config.example.json default-config.json   # once — fill in real Atlas URI & password
npm run fetch-mongod   # once — downloads mongod.exe (~50 MB)
npm run prepare-server # after any change to the web app code
npm run dist           # produces dist/Majid Steel Warehouse Setup 1.0.0.exe
```

To run without installing (for testing): `npm start`

## Configuration

On first launch a `config.json` is created in
`%APPDATA%/majid-steel-desktop/`:

| key                 | meaning                                    |
|---------------------|--------------------------------------------|
| atlasUri            | MongoDB Atlas connection string for sync   |
| authEmail/Password  | login credentials for the app              |
| syncIntervalMinutes | how often to sync (default 3)              |

Edit and restart the app to apply.
