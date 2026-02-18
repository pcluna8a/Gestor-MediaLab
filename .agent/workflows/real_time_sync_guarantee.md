---
description: How this application guarantees real-time data synchronization and offline robustness.
---

# Real-Time Sync & Offline Guarantee

This workflow ensures that the MediaLab Manager application provides a seamless, real-time experience for all users, regardless of their device or network condition.

## 1. The Architecture of "Now"

The application uses **Firestore Real-time Listeners** (`onSnapshot`) as the core data fetching mechanism. This is fully implemented in `services/firebaseService.ts` and consumed via `DataContext.tsx`.

### How it works:
1.  **Subscription**: When the app loads, `DataContext` subscribes to the `equipment`, `loans`, and `users` collections.
2.  **Push Updates**: Instead of the app asking "is there new data?", the database **pushes** changes to the app immediately.
3.  **Instant Reflection**: If `User A` lends a camera, `User B`'s screen updates explicitly within milliseconds (latency dependent).

## 2. The "No Internet" Guarantee (Offline Persistence)

We have explicitly enabled **Firestore Offline Persistence** (`enableIndexedDbPersistence`).

### Scenario: Internet Connection Lost
1.  **Seamless caching**: The app continues to read from a local IndexedDB cache of your data.
2.  **Write Queuing**: If you register a loan while offline, Firebase queues this action locally.
3.  **Optimistic UI**: The app updates the UI *immediately* as if the action succeeded, so the instructor is not blocked.
4.  **Auto-Sync**: As soon as connection is restored, Firebase synchronizes the queued changes to the cloud automatically.

## 3. Verification Steps

To verify this guarantee manually:

1.  **Real-Time Test**:
    - Open the App in two different browsers (or an Incognito window).
    - Login as Instructor in both.
    - Creating a loan in Window A should make the equipment disappear from "Available" in Window B instantly.

2.  **Offline Test**:
    - Load the dashboard.
    - Disconnect your computer from WiFi/Internet.
    - Reload the page. **It should still load** (serving from cache).
    - Register a loan.
    - Reconnect WiFi.
    - Check the Firebase Console; the loan should appear.
