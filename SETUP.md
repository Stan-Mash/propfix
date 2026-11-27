# PropertyFix – Setup Guide

## 1. Create a Firebase Project

1. Go to https://console.firebase.google.com
2. Click **Add project** → name it `propertyfix` (or anything you like)
3. Enable **Google Analytics** (optional)

## 2. Enable Firebase Services

### Authentication
- Left menu → **Authentication** → **Get started**
- Enable **Email/Password** provider

### Firestore Database
- Left menu → **Firestore Database** → **Create database**
- Start in **production mode** → choose your region
- After creation, go to **Rules** and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    match /complaints/{complaintId} {
      allow read, write: if request.auth != null;
      match /comments/{commentId} {
        allow read, write: if request.auth != null;
      }
    }
    match /properties/{propertyId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

> **Index required:** The comments subcollection queries by `createdAt`. Firestore will show a link in the console to create the index the first time it's queried — click it once and it will build automatically.

### Storage (for photos and quotations)
- Left menu → **Storage** → **Get started** → production mode
- After creation, go to **Rules** and paste:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 3. Get Your Firebase Config

1. In Firebase Console → Project Settings (⚙️ gear icon)
2. Scroll down to **Your apps** → click **</>** (Web)
3. Register the app → copy the `firebaseConfig` object
4. Open `firebase.js` in the project root and replace the placeholder values

## 4. Run the App

Make sure you have Expo Go installed on your phone (Android or iOS).

```bash
cd maintenance-tracker
npx expo start
```

Scan the QR code with **Expo Go** (Android) or your **Camera app** (iOS).

## 5. First-Time Setup

1. Register the **Landlord** account first
2. Register a **Manager** account
3. Register **Caretaker** accounts

Each user selects their role at registration.

## App Flow Summary

```
Caretaker → Files complaint (+ optional quotation PDF)
    ↓
Manager → Reviews it → Assigns contractor → Forwards to Landlord
    ↓
Landlord → Approves or Rejects quotation
    ↓
Contractor → Starts work → Uploads completion photos
    ↓
Landlord → Marks Resolved
```

## Push Notifications

Push notifications are sent via Expo's free push service. They work in development builds but **not** in Expo Go. To test them:

1. Build a development build: `npx expo run:android` or `npx expo run:ios`
2. Notifications fire when a complaint is forwarded, approved, rejected, or assigned to a contractor.

## Project Structure

```
maintenance-tracker/
├── App.js                          # Entry point + OfflineBanner
├── firebase.js                     # Firebase config (fill this in!)
└── src/
    ├── context/AuthContext.js      # Auth + push token registration
    ├── navigation/AppNavigator.js  # All routes
    ├── components/
    │   ├── ComplaintCard.js        # Reusable complaint list item
    │   ├── StatusBadge.js          # Colored status pill
    │   ├── CommentThread.js        # In-complaint chat
    │   ├── ImageLightbox.js        # Full-screen photo viewer
    │   └── OfflineBanner.js        # No-internet indicator
    ├── utils/
    │   ├── imageUtils.js           # Auto-compress before upload
    │   ├── fileUtils.js            # Download, share, CSV export
    │   └── notificationUtils.js    # Expo push notifications
    └── screens/
        ├── auth/                   # Login + Register
        ├── caretaker/              # Dashboard, File, My Reports, Edit
        ├── contractor/             # Job list + Job detail
        ├── manager/                # Dashboard + Review Detail
        ├── landlord/               # Dashboard, Reports, Properties
        └── shared/                 # Read-only complaint detail
```
