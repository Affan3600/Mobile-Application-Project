# SmartHome App — Code Walkthrough

A line-by-line guide to every main part of this Expo / React Native app. Every reference has the form
`path:line` or `path:start-end`, and **all line numbers describe the code exactly as committed with this file**.
If you edit a file, the numbers below will drift.

> Stack: Expo SDK 58 · React Native 0.88 · React 19.3 · TypeScript 6 · React Navigation 7 · local (AsyncStorage) backend.

---

## Table of contents

1. [What the app does](#1-what-the-app-does)
2. [Project layout](#2-project-layout)
3. [Architecture at a glance](#3-architecture-at-a-glance)
4. [Startup sequence](#4-startup-sequence)
5. [Navigation](#5-navigation)
6. [Data types](#6-data-types)
7. [Configuration and environment](#7-configuration-and-environment)
8. [Backend layer (`src/services`)](#8-backend-layer-srcservices)
9. [State: React contexts](#9-state-react-contexts)
10. [Hooks](#10-hooks)
11. [Shared components](#11-shared-components)
12. [Screens](#12-screens)
13. [Background geofence task](#13-background-geofence-task)
14. [Native / project configuration](#14-native--project-configuration)
15. [End-to-end flows](#15-end-to-end-flows)
16. [Known limitations and gotchas](#16-known-limitations-and-gotchas)

---

## 1. What the app does

SmartHome is a demo smart-home controller. A signed-in user can:

- **Log in or register** (preset demo accounts plus self-registered accounts stored on the device).
- **Control devices**: lights, plugs, thermostats, locks, cameras, a router, grouped by room.
- **See a floor plan** with tappable device pins.
- **Watch camera tiles** that loop bundled demo footage.
- **Use voice commands** ("turn on the kitchen light", "open cameras") through on-device speech recognition, with spoken confirmation.
- **Run location automations** (geofence): arriving/leaving home runs automations such as unlocking the door.
- **Manage family roles** (admin / member / guest) that decide what each person may do.

There is **no real server**. All data lives in AsyncStorage through `MockSmartHomeApi`. The code is structured so a real
backend can be swapped in behind one interface (see section 8.1).

---

## 2. Project layout

```
App.tsx                      root component (providers + navigation)
index.ts                     Expo entry point
app.json                     Expo config (permissions, plugins)
app.config.snippet.json      reference config for maps/location (not loaded by Expo)
.env.example                 environment variable template
assets/                      icons, splash, and assets/videos/garage-cam.mov (demo footage)
docs/CODE_WALKTHROUGH.md     this file
src/
  config.ts                  runtime config read from EXPO_PUBLIC_* env vars
  theme.ts                   colours, spacing, radii
  types.ts                   shared TypeScript types
  navigation/index.tsx       login stack + bottom tabs
  context/                   AuthContext, HomeContext (global state)
  hooks/                     useOrientation, useVoiceRecorder
  components/                Screen, VoiceSearchBar, DeviceCard, ForegroundGeofence
  screens/                   Login, Dashboard, FloorPlan, Cameras, Geofence, Scanner, Settings
  services/                  api interface, mock backend, voice parsing, demo data
  tasks/geofence.ts          background geofence task + helpers
```

---

## 3. Architecture at a glance

```
index.ts ─► App.tsx
              │
              ├─ SafeAreaProvider
              │    └─ AuthProvider  (who is signed in, role flags)
              │         └─ HomeProvider  (devices, rooms, home, automations)
              │              ├─ ForegroundGeofence  (invisible location watcher)
              │              └─ Navigation
              │                   ├─ not signed in ─► LoginScreen
              │                   └─ signed in ─► Tabs (Devices, Floor Plan, Cameras, Geofence, Settings)
              │                                    + Scanner (modal)
              │
              └─ every screen talks only to ─► `api` (src/services/index.ts)
                                                   └─ MockSmartHomeApi ─► AsyncStorage
```

Key design rule: **screens never import the mock backend**. They use `api` from `src/services/index.ts`, which is typed as
the `SmartHomeApi` interface. Replacing the backend means writing another class that satisfies that interface.

---

## 4. Startup sequence

### `index.ts` (8 lines)
| Lines | What it does |
|---|---|
| `index.ts:1` | Imports `registerRootComponent` from `expo`. |
| `index.ts:3` | Imports the `App` component. |
| `index.ts:8` | Registers `App` as the root, so it works in Expo Go and in native builds. |

### `App.tsx` (22 lines)
| Lines | What it does |
|---|---|
| `App.tsx:1` | **Side-effect import** of `src/tasks/geofence`. This runs `TaskManager.defineTask` at app start. A background task must be defined at module scope before the OS can wake the app for it. |
| `App.tsx:10-22` | The `App` component. Provider nesting order matters: |
| `App.tsx:12` | `SafeAreaProvider` supplies screen-inset info to every `SafeAreaView`. |
| `App.tsx:13` | `AuthProvider` is outside `HomeProvider` because `HomeProvider` reads the signed-in user. |
| `App.tsx:14` | `HomeProvider` loads devices/rooms once a user exists. |
| `App.tsx:15` | `StatusBar style="dark"` for the light theme. |
| `App.tsx:16` | `ForegroundGeofence` renders nothing but runs a location watcher (section 11.4). |
| `App.tsx:17` | `Navigation` chooses login vs main app. |

---

## 5. Navigation

File: `src/navigation/index.tsx` (74 lines). Uses React Navigation (JS-driven stack and tabs), **not** Expo Router.

| Lines | What it does |
|---|---|
| `:17-18` | Creates one native stack (`Stack`) and one bottom-tab navigator (`Tab`). |
| `:20-27` | `TAB_ICONS` maps each tab name to a MaterialCommunityIcons icon. `IconName` (line 20) is derived from the icon component's props so icon names are type-checked. |
| `:29-47` | `Tabs()` defines the five tabs: Devices (`:40`), Floor Plan (`:41`), Cameras (`:42`), Geofence (`:43`), Settings (`:44`). Headers are hidden (`:33`) because each screen draws its own header through `Screen`. Colours come from the theme (`:34-36`). |
| `:49-74` | `Navigation()` is the auth gate. |
| `:50` | Reads `user` and `loading` from `useAuth()`. |
| `:52-58` | While the saved session is being restored (`loading`), shows a spinner so the login screen does not flash. |
| `:61` | `NavigationContainer` with the default theme overridden with the app background and primary colour. |
| `:63-70` | **Conditional screens**: signed in → `Main` (the tabs, `:65`) and `Scanner` as a modal (`:66`); signed out → only `Login` (`:69`). Because the screens are swapped, logging out automatically returns to Login. |

Voice navigation (section 11.2) calls `navigation.navigate('Cameras')` etc., using the tab names defined at `:40-44`.

---

## 6. Data types

File: `src/types.ts` (64 lines).

| Lines | Type | Notes |
|---|---|---|
| `:1` | `Role` | `'admin' \| 'member' \| 'guest'`. |
| `:3-13` | `User` | Stored record. `passwordHash` (`:8`) and `salt` (`:9`) hold the hashed password; `password` (`:11`) is a **legacy plain-text field** kept only so old saved data can be migrated. |
| `:14` | `SessionUser` | `User` minus `password`, `passwordHash`, `salt`. This is the only user shape the UI ever sees. |
| `:16` | `DeviceType` | `light, plug, thermostat, lock, camera, router`. |
| `:18-32` | `Device` | Common fields (`id, name, type, roomId, vendor, online`) plus optional per-type fields: `on` (`:25`), `brightness` (`:26`), `targetTemp`/`currentTemp` (`:27-28`), `locked` (`:29`), `streamUrl` (`:30`), `clients` (`:31`). |
| `:33` | `NewDevice` | A `Device` without an `id`, used when adding or scanning. |
| `:36-43` | `Room` | Position and size are **percentages (0-100)** of the floor-plan box. |
| `:45-50` | `HomeConfig` | Home name, latitude, longitude, and geofence `radius` in metres. |
| `:52` | `AutomationTrigger` | `'arrive' \| 'leave'`. |
| `:53-56` | `AutomationAction` | A device id and a `Partial<Device>` patch to apply. |
| `:57-64` | `Automation` | Name, description, trigger, enabled flag, and a list of actions. |

---

## 7. Configuration and environment

### `src/config.ts` (16 lines)
| Lines | What it does |
|---|---|
| `:1-4` | Comment: anything prefixed `EXPO_PUBLIC_` is **bundled into the app and visible to users**. |
| `:5-6` | Reads Supabase URL and anon key from the environment (currently unused by the code path, see section 16). |
| `:8-16` | The exported `config` object: `sttProvider` (`:9`), `openAiKey` (`:10`), `sttProxyUrl` (`:11`), Supabase values (`:12-13`), `useSupabase` (`:14`, true only when both Supabase values are set) and `mockLatencyMs` (`:15`, an artificial 250 ms delay that makes the mock feel like a network). |

### `.env.example`
Template for `EXPO_PUBLIC_STT_PROVIDER`, `EXPO_PUBLIC_OPENAI_API_KEY`, `EXPO_PUBLIC_STT_PROXY_URL`,
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Copy to `.env` locally. **`.env` is git-ignored; never commit real keys.**
Speech recognition no longer needs any of these (section 10.2).

### `src/theme.ts` (17 lines)
| Lines | What it does |
|---|---|
| `:1` | Palette comment (deep navy, sky blue, one orange accent). |
| `:2-15` | `colors`: `bg, surface, surfaceAlt, border, text, textDim, primary, accent, accentSoft, warn, danger, ok`. |
| `:16` | `spacing`: `xs 4, sm 8, md 12, lg 16, xl 24`. |
| `:17` | `radius`: `sm 8, md 14, lg 22`. |

All styling reads from these constants, so the look can be changed in one place.

---

## 8. Backend layer (`src/services`)

### 8.1 `api.ts`: the backend contract (44 lines)
`SmartHomeApi` (`:16-44`) lists everything the UI may ask of a backend:

| Lines | Group | Methods |
|---|---|---|
| `:18-25` | Auth + people | `login` (`:18`), `register` (`:20`), `logout` (`:21`), `getSessionUser` (`:23`), `listUsers` (`:24`), `setUserRole` (`:25`) |
| `:28-34` | Home + devices | `getHome`, `setHome`, `getRooms`, `getDevices`, `updateDevice`, `addDevice`, `scanForDevices` |
| `:37-38` | Automations | `getAutomations`, `setAutomationEnabled` |
| `:41` | Sync | `subscribe(onChange)` returns an unsubscribe function |
| `:43` | Demo | `resetDemoData` |

### 8.2 `index.ts`: backend selection
`src/services/index.ts` exports a single `api` instance typed as `SmartHomeApi`. It always creates `MockSmartHomeApi`.
(The file begins with a UTF-8 byte-order mark, which lint warns about but is harmless.)

### 8.3 `mockApi.ts`: the local backend (255 lines)

**Storage keys and shapes**
| Lines | What it does |
|---|---|
| `:2` | Imports `expo-crypto` for password hashing. |
| `:17` | `KEY = 'smarthome.db.v1'`: AsyncStorage key holding the whole database as JSON. |
| `:18` | `SESSION_KEY`: stores just the id of the signed-in user. |
| `:20-26` | `Db` interface: `users, rooms, devices, automations, home`. |

**Seed data (`seed`, `:28-84`)**: the starting database.
| Lines | Content |
|---|---|
| `:29-33` | Three **preset accounts**: Admin (`admin@smarthome.app` / `admin123`), Family Member (`member@smarthome.app` / `member123`), Guest (`guest@smarthome.app` / `guest123`). Written with plain `password` here and hashed on first load. |
| `:34-40` | Five rooms (Living Room, Kitchen, Bedroom, Entry, Garage) with percentage rectangles. |
| `:41-52` | Ten devices `d1`-`d10`. `d8` Front Door Camera and `d9` Garage Camera are the two cameras (both online). |
| `:53-81` | Two automations: "Welcome home" (arrive) and "Leaving home" (leave). |
| `:82-83` | Default home location: Ontario Tech University campus, 150 m radius. |

**Helpers**
| Lines | What it does |
|---|---|
| `:86` | `sleep(ms)`. |
| `:87` | `clone` deep-copies via JSON so callers cannot mutate the in-memory database. |
| `:88` | `toSession` strips `password`, `passwordHash`, `salt` before a user leaves the backend. |
| `:89` | `clamp(n, lo, hi)`. |
| `:91` | `EMAIL_RE`, a basic email shape check. |
| `:95-97` | `hashPassword`: SHA-256 of `salt:password` via `Crypto.digestStringAsync`. |
| `:98-101` | `newSalt`: 16 secure random bytes as a hex string. |
| `:102-106` | `withHashedPassword`: returns a copy of a user with a fresh salt + hash and the legacy `password` field removed. |

> Security note: a single salted SHA-256 is **demo-grade**. `expo-crypto` has no slow KDF (PBKDF2/scrypt/argon2). A real
> backend must do the hashing server-side.

**`MockSmartHomeApi` class (`:108-255`)**
| Lines | Member | What it does |
|---|---|---|
| `:109-111` | fields | `db` (in-memory cache), `loading` (in-flight load promise), `listeners` (subscribers). |
| `:113-120` | `load()` | Returns the cached DB, or shares **one** in-flight load promise (`??=` at `:116`) so concurrent callers do not each seed/migrate. |
| `:121-136` | `loadFromStorage()` | Reads JSON (`:122`), falls back to `seed()` (`:123`). `:126-133` migrates any user that still has a plain `password` into `salt + passwordHash`. Saves only if something changed (`:134-135`). |
| `:137-139` | `persist()` | Writes the whole DB to AsyncStorage. |
| `:140-143` | `commit()` | `persist()` then notifies every subscriber. Every mutation ends with this, which is how the UI stays in sync. |
| `:144-146` | `delay()` | Waits `mockLatencyMs`. |
| `:148-153` | `subscribe()` | Registers a listener, returns an unsubscribe function. |
| `:155-163` | `login()` | Finds the user by lower-cased email (`:158`), re-hashes the supplied password with the stored salt and compares (`:159`), throws `Incorrect email or password.` on any mismatch (`:160`), saves the session id (`:161`). The same error for unknown email and wrong password avoids revealing which emails exist. |
| `:164-179` | `register()` | Validates email (`:168`), password length ≥ 6 (`:169`), duplicate email (`:170`). Hashes (`:171-174`), pushes the user as role `guest` (`:175`), commits, and signs the user in. |
| `:180-182` | `logout()` | Removes the session key. |
| `:183-188` | `getSessionUser()` | Looks up the saved id; returns `null` if none or the user vanished. |
| `:189-192` | `listUsers()` | All users as `SessionUser`s. |
| `:193-200` | `setUserRole()` | Changes a role and commits. |
| `:201-208` | `getHome` / `setHome` | Read/write the home config. |
| `:209-214` | `getRooms` / `getDevices` | Return clones. |
| `:215-225` | `updateDevice()` | Merges a patch (`:219`), clamps brightness 0-100 (`:220`) and target temperature 10-30 (`:221`), commits. |
| `:226-232` | `addDevice()` | Creates id `d<timestamp>`. |
| `:233-238` | `scanForDevices()` | Waits 1.8 s to feel like a scan, returns catalog entries not already added (matched by name). |
| `:239-248` | automations | `getAutomations` (`:239`), `setAutomationEnabled` (`:242`). |
| `:249-254` | `resetDemoData()` | **Keeps registered users** (`:251`), resets devices/rooms/automations/home from `seed()` (`:252`). |

### 8.4 `automations.ts` (18 lines)
`runAutomations(trigger)` (`:5-18`): loads all automations (`:6`), keeps the enabled ones for the trigger (`:7`), applies each
action's patch to its device (`:8-16`; a failing action is swallowed so a removed device does not stop the rest), and returns how
many automations ran (`:17`). It is safe to call from the background task because it only uses `api`.

### 8.5 `demoCatalog.ts` (12 lines)
| Lines | What it does |
|---|---|
| `:3` | `STREAM`: a public HLS test URL, the fallback for cameras without bundled footage. |
| `:6-12` | `SCAN_CATALOG`: the devices the pretend network scan "discovers" (Hallway Light, Space Heater Plug, Bedroom Thermostat, Back Door Lock, Kitchen Camera). |

### 8.6 `demoVideos.ts` (11 lines)
| Lines | What it does |
|---|---|
| `:6` | `require()`s the bundled clip `assets/videos/garage-cam.mov`. Metro turns this into a numeric asset id. |
| `:8-11` | `DEMO_VIDEOS` maps camera ids to that clip: `d8` Front Door Camera and `d9` Garage Camera. To use different footage, add a file to `assets/videos/` and edit these lines. |

### 8.7 `voiceCommands.ts`: turning a sentence into an action (102 lines)
Pure function, no side effects, easy to test.

| Lines | What it does |
|---|---|
| `:3` | `ScreenName` union of the tab names. |
| `:5-8` | `Intent`: `navigate` (go to a screen), `device` (patch some devices), or `unknown`. Each carries a `spoken` string for the reply. |
| `:10-16` | `NAV`: regexes that map words ("camera", "map", "settings"…) to tabs. Order matters: first match wins. |
| `:18-25` | `TYPE_WORDS`: synonyms per device type ("lamp" → light, "outlet" → plug). |
| `:27` | `tokens()` splits on non-alphanumerics. |
| `:29-34` | `score()`: +1 for every device-name word in the sentence (words of 3+ letters, with plural tolerance), +1 if a type word matches. |
| `:36-55` | `detectPatch()`: decides *what* to do for a device type: lock/unlock (`:37-41`), thermostat target from a 2-digit number (`:42-45`), light brightness from "N percent" (`:46-49`), on/off (`:50-54`). |
| `:57-65` | `describe()`: builds the confirmation phrase ("turned on", "set to 72 degrees"…). |
| `:67-102` | `parseCommand()`: the main entry. |
| `:68` | Lowercases and strips punctuation. |
| `:69` | Empty text → "I did not catch that." |
| `:72` | `wantsAll` if the sentence contains "all"/"every". |
| `:73-77` | Scores every device and keeps those with score > 0, best first. |
| `:78-83` | Picks the best-scoring group (same type if "all", else same score), then keeps devices that have an actionable patch. |
| `:85-87` | If several devices tie and the user did not say "all", asks "Which one: A or B?". |
| `:88-95` | Otherwise returns a `device` intent with a spoken confirmation. |
| `:98-100` | Falls back to navigation regexes. |
| `:101` | Otherwise "Sorry, I did not understand that." |

### 8.8 `stt.ts`: cloud speech-to-text (legacy, unused) (40 lines)
Defines `SpeechToText` (`:3-5`), a `WhisperStt` class (`:8-31`) that uploads an `.m4a` to OpenAI or a proxy, and a `GoogleStt`
placeholder (`:34-38`). The app **no longer calls this**; recognition now runs on-device (section 10.2). Kept in case a cloud
fallback is wanted later.

---

## 9. State: React contexts

### 9.1 `AuthContext.tsx` (79 lines)
| Lines | What it does |
|---|---|
| `:5-14` | `AuthState` shape: `user`, `loading`, `login`, `register`, `logout`, and three permission flags: `canControl` (`:11`), `canViewCameras` (`:12`), `canManage` (`:13`). |
| `:18` | `same()` compares id, role, and name to avoid pointless state updates. |
| `:20-77` | `AuthProvider`. `:24-30` restores the saved session on startup via `api.getSessionUser()` and clears `loading` in `finally`. |
| `:34-43` | Subscribes to backend changes so a **role change by an admin applies immediately** to the affected user. A failed lookup (offline) keeps the current user instead of signing them out. |
| `:45-47` | `login` calls `api.login` and stores the user. |
| `:49-51` | `register` does the same for sign-up. |
| `:53-56` | `logout` clears backend session, then local state. |
| `:58-72` | The memoized context value. Roles: admin and member can control devices and view cameras (`:66-67`); only admin can manage (`:68`). |
| `:75-79` | `useAuth()` throws a clear error if used outside the provider. |

### 9.2 `HomeContext.tsx` (94 lines)
| Lines | What it does |
|---|---|
| `:6-17` | `HomeState`: `devices`, `rooms`, `home`, `automations`, `loading`, and actions. |
| `:21-27` | Provider state. |
| `:29-36` | `refresh()` fetches devices, rooms, home and automations **in parallel** (`:30`). |
| `:38-41` | Loads data once a user exists; re-runs when the user id changes. |
| `:43-50` | Subscribes to backend changes and refreshes (this is what makes automations, voice commands and other screens update live). |
| `:52-63` | `updateDevice` is **optimistic**: updates local state first (`:54`), calls the API (`:56`), and on failure reloads server truth (`:58`) and rethrows. |
| `:65-85` | Memoized value; `addDevice`, `setHome`, `setAutomationEnabled` simply call the API (the subscription then refreshes state). |
| `:90-94` | `useHome()` guard hook. |

---

## 10. Hooks

### 10.1 `useOrientation.ts` (7 lines)
Reads window size with `useWindowDimensions` (`:5`) and returns `isLandscape = width > height` (`:6`). Screens use it to switch
between one and several columns.

### 10.2 `useVoiceRecorder.ts`: on-device speech recognition (70 lines)
Uses `expo-speech-recognition` (Google's recognizer on Android, Apple's on iOS). **No API key.** Needs a development build, not Expo Go.
It keeps the same shape as the old Whisper hook so `VoiceSearchBar` did not change.

| Lines | What it does |
|---|---|
| `:2` | Imports the module and the event hook. |
| `:4` | `VoiceStatus = 'idle' \| 'recording' \| 'processing'`. |
| `:6` | `END_TIMEOUT_MS = 8000`: the longest we wait for the recognizer to finish after stop. |
| `:13-17` | State: `status`, plus refs for the latest `transcript`, `lastError`, and an `endWaiter` callback. Refs avoid stale closures in event handlers. |
| `:19-22` | `result` event: stores the newest transcript (`event.results[0].transcript`). Interim results arrive here too, so the last one wins. |
| `:24-28` | `error` event: ignores `no-speech` and `aborted` (normal outcomes), records anything else, and releases the waiter. |
| `:30-32` | `end` event: releases the waiter. |
| `:34-49` | `start()`: requests permission (`:35`), throws a readable error if denied (`:36`) or recognition is unavailable (`:37-39`), clears old results (`:40-41`), starts recognition with `lang: 'en-US'`, interim results, non-continuous (`:42-47`), sets status `recording` (`:48`). |
| `:51-67` | `stopAndTranscribe()`: sets `processing` (`:52`), creates a promise that resolves on `end`/`error` or after 8 s (`:54-58`), calls `stop()` (`:59`) so the engine delivers its final result, awaits it (`:60`), throws if there was an error and no text (`:61`), returns the trimmed transcript (`:62`). The `finally` (`:63-66`) always returns to `idle`. |
| `:69` | Returns `{ status, start, stopAndTranscribe }`. |

---

## 11. Shared components

### 11.1 `Screen.tsx` (47 lines)
Common page frame: safe area (`:21`, top/left/right only because the tab bar handles the bottom), title + subtitle (`:23-26`),
an optional `VoiceSearchBar` (`:27-31`), and the body (`:33`). In landscape the header becomes a row and the search bar is 380 px
wide (`:22`, `:45`). Styles `:38-47`.

### 11.2 `VoiceSearchBar.tsx`: search + voice (149 lines)
| Lines | What it does |
|---|---|
| `:15-18` | Props: `value` / `onChangeText` let a screen control the text (the Dashboard uses it to filter devices). Without them the bar keeps its own text (`:30-32`). |
| `:22-32` | Hooks: navigation, devices + `updateDevice`, `canControl`, the voice hook, and local message/timer state. |
| `:34-36` | Clears the pending message timer on unmount. |
| `:38-46` | `feedback(display, spoken?)`: shows a message under the bar, **speaks** it with `Speech.speak` after `Speech.stop()` (`:41-42`), and hides the message after 6 s (`:45`). |
| `:48-78` | `run(utterance, source)`: the command handler. |
| `:50` | Parses the sentence with `parseCommand`. |
| `:53-56` | Unknown: voice input gets a spoken "didn't understand"; **typed** input is silently left as a plain search filter. |
| `:57-61` | Navigate intent → `navigation.navigate(screen)` plus spoken confirmation. |
| `:62-65` | Guests (`!canControl`) are told the account is view-only. |
| `:66-70` | Offline targets are refused. |
| `:71-77` | Applies the patch to all online targets in parallel (`:72`) and confirms, or reports failure. |
| `:81-93` | `onMic()`: idle → start listening; recording → stop, transcribe, and run the result; shows "No speech detected." when empty (`:87`). |
| `:95-130` | UI: search icon, text input (submit runs a typed command, `:101`), clear button (`:109-113`), and the round mic button (`:115-126`) that shows a spinner while processing and turns orange while recording. |
| `:132-149` | Styles. |

### 11.3 `DeviceCard.tsx`: one device tile (153 lines)
| Lines | What it does |
|---|---|
| `:7-13` | Props: the device, room name, `canControl`, `onChange(patch)`, optional `onOpenCamera`. |
| `:17-26` | `iconFor()`: picks an icon per type and state (bulb on/off, lock open/closed…). |
| `:28-36` | `isActive()` (exported, also used by the floor plan): offline is never active; locks are active when locked; cameras and routers always; others when `on`. |
| `:38-48` | `statusText()`: "On · 70%", "Heating to 21° · now 20°", "Locked", "Live", "Online · 14 connected"… |
| `:50-62` | `Stepper`: a − / label / + control used for brightness and temperature. |
| `:64-127` | `DeviceCard`. `:65-66` compute `active` and `disabled` (no permission or offline). `:80-87` shows a `Switch` for lights, plugs, and thermostats. `:92-99` brightness stepper in steps of 10. `:101-108` thermostat stepper in steps of 1°. `:110-118` lock/unlock button. `:120-124` "Watch live" button that calls `onOpenCamera`. |
| `:129-153` | Styles; active cards use the accent colours, offline cards are faded. |

### 11.4 `ForegroundGeofence.tsx` (60 lines)
An invisible component (returns `null`, `:59`) that backs up the native geofence while the app is open, because Android's
geofence events can be slow or never arrive on the emulator.
| Lines | What it does |
|---|---|
| `:11` | Needs the home location from `useHome()`. |
| `:15-17` | `sub` (subscription), `cancelled`, and `starting` guards against races. |
| `:24-42` | `start()`: only if foreground permission is already granted (`:28-29`), watches position every 2 s at high accuracy (`:30-31`), and for each fix computes the distance to home and calls `evaluateFix` (`:33-34`). If the effect was cleaned up while starting, the new subscription is removed immediately (`:37`). |
| `:44-48` | `tick()`: if monitoring is enabled (or the native geofence is running) start watching, otherwise stop. |
| `:50-51` | Runs once, then every 4 s so toggling the switch takes effect quickly. |
| `:52-57` | Cleanup: flags cancelled, clears the interval, stops the watcher. |
| `:57` | The effect re-runs when the home coordinates or radius change. |

---

## 12. Screens

### 12.1 `LoginScreen.tsx` (141 lines)
| Lines | What it does |
|---|---|
| `:10-14` | `DEMO`: the three preset accounts shown as tap-to-fill chips. |
| `:19-24` | State: sign-up mode, name, email, password, busy, error. |
| `:26-42` | `submit()`: sign-up mode checks the password length (`:31`) and calls `register` with the name or the email prefix as a fallback (`:32`); otherwise calls `login`. Errors from the backend appear inline (`:36`). |
| `:44-52` | Landscape-aware layout with a keyboard-avoiding scroll view. |
| `:54-62` | Name field, only shown when creating an account. |
| `:63-83` | Email and password fields; return on the password field submits (`:76`). |
| `:84` | Submit button label switches between "Create account" and "Sign in". |
| `:87-95` | Toggle between sign-in and sign-up. |
| `:96` | Helper text. Note: it says the first account on a *brand-new backend* becomes admin; that is true of a real backend, not this mock (new mock accounts are guests). |
| `:98-115` | Demo chips, hidden when `config.useSupabase` is true. |
| `:124-141` | Styles. |

### 12.2 `DashboardScreen.tsx`: "My home" (119 lines)
| Lines | What it does |
|---|---|
| `:13-22` | `Filter` type and the filter chips (All, Lights, Plugs, Climate, Locks, Cameras, Network). |
| `:26-31` | State: `query` (shared with the voice/search bar), `filter`, `refreshing`. |
| `:34` | Column count: 3 above 900 px wide, 2 in landscape, else 1. |
| `:36-44` | `visible` list: applies the type filter and searches name, room, and vendor. |
| `:46-47` | Counts shown in the subtitle: active (online and on, or any online camera) and offline. |
| `:49-53` | Pull-to-refresh. |
| `:56-61` | `Screen` wrapper; the subtitle also shows the user's role (`:58`). |
| `:63-70` | Horizontal filter chips. |
| `:72-97` | Loading spinner, or a `FlatList` (`:75`). `key={cols-N}` (`:76`) forces a re-mount when the column count changes, which React Native requires for `numColumns`. Each item is a `DeviceCard` (`:87-93`) wired to `updateDevice`. |
| `:99-104` | **Add device** floating button, admins only (`canManage`), opens the Scanner modal. |

### 12.3 `FloorPlanScreen.tsx` (105 lines)
| Lines | What it does |
|---|---|
| `:14-22` | `PIN_ICONS`: icon per device type. `PIN = 36` is the pin diameter. |
| `:31-32` | Plan size: in landscape, ~55% of width capped by height; portrait uses full width; height is 80% of width. |
| `:35-70` | The plan. `:37-44` draws each room as an absolutely positioned rectangle by converting its percentages to pixels. `:45-68` places device pins: devices in a room are spread evenly across it horizontally (`:48`) at 62% of the room's height (`:49`). |
| `:55-61` | Pin styles change when active, offline, or selected. |
| `:72-82` | Selected device shows a full `DeviceCard`; otherwise a hint. |
| `:84-91` | Layout; side-by-side in landscape. |

### 12.4 `CamerasScreen.tsx` (91 lines)
| Lines | What it does |
|---|---|
| `:10` | Imports `DEMO_VIDEOS`. |
| `:14-32` | `LiveTile`. `:15` picks the player source: **bundled footage first, then the device's stream URL, otherwise `null`**. `:16-18` loop it, mute it, and play it. `:23` renders `VideoView` with the `cover` fit, no native controls, and fullscreen enabled. `:24-27` draws the red "Live" badge. |
| `:34-44` | `OfflineTile` for offline cameras. |
| `:46-77` | `CamerasScreen`. |
| `:47` | `useIsFocused()`: streams only play while this tab is visible, which saves battery and decoder instances. |
| `:52-54` | Filters camera devices and computes tile width: 2 columns in landscape. |
| `:57` | Subtitle "X of Y online". |
| `:58-62` | Guests see a lock message instead of feeds. |
| `:64-73` | Grid of tiles. A camera plays if it is online and has either demo footage or a stream URL (`:67`); if the tab is not focused, an empty placeholder keeps the layout (`:68`). |

### 12.5 `GeofenceScreen.tsx` (260 lines)
| Lines | What it does |
|---|---|
| `:14-15` | Radius limits 100-500 m (Android geofences smaller than ~100 m are unreliable). |
| `:27-29` | Checks whether native monitoring is already running. |
| `:32-49` | Follows the phone's position (every 2 s) to draw the "You are here" marker. |
| `:51-57` | Re-centres the map when the home moves. |
| `:59-65` | Spinner until the home config loads. |
| `:67-70` | `saveHome`: saves, and re-registers the geofence if monitoring is on. |
| `:72-83` | `toggleMonitoring`: starts or stops; errors (e.g. permission denied) become an alert. |
| `:87-108` | `getFix`: waits for a real GPS fix with `watchPositionAsync` and a timeout, which is more reliable than one-shot `getCurrentPositionAsync`. |
| `:110-135` | `useMyLocation`: asks permission, checks location services, tries `getFix` for 30 s, falls back to the last known position, and saves it as home. |
| `:137-140` | `changeRadius` clamps to the limits. |
| `:142-145` | `simulate`: runs the arrive/leave automations immediately for demos. |
| `:147-166` | Google Map with a home marker, an optional "you" marker, and a circle for the radius. |
| `:168-234` | Controls: distance readout (`:170-176`), monitoring switch (`:177-183`), radius −/+ (`:185-195`), "set home to my location" (admins, `:197-201`), automation toggles (`:203-217`), and simulate buttons (members and admins, `:219-232`). |
| `:236-244` | Layout. |

### 12.6 `ScannerScreen.tsx`: add devices (88 lines)
| Lines | What it does |
|---|---|
| `:14-16` | State: scanning flag, found devices, names already added. |
| `:18-25` | `scan()` asks the backend (which pretends to scan the network) and always clears the spinner. |
| `:27-30` | `add()` adds a device and remembers its name so the button shows "Added". |
| `:32-44` | Header with a Done button, and the scan button (`:41-44`). |
| `:46-69` | Results list with an empty-state message and an Add/Added button per device. |

### 12.7 `SettingsScreen.tsx` (111 lines)
| Lines | What it does |
|---|---|
| `:11-16` | Role list and a short description per role. |
| `:24-27` | Loads the member list. |
| `:29-32` | `setRole` updates a role and reloads. |
| `:34-46` | `reset`: confirmation dialog, then `resetDemoData`, then refreshes both home data and members. The dialog text states that devices, automations, and home location reset (accounts are kept). |
| `:51-72` | One card per member with role buttons. Buttons are locked unless you are an admin, and you cannot change **your own** role (`:58`). |
| `:73` | Non-admins see "Only admins can change roles." |
| `:75-85` | Admin-only actions: scan for devices and reset demo data. |
| `:87-89` | Sign-out button. |

---

## 13. Background geofence task

File: `src/tasks/geofence.ts` (109 lines).

| Lines | What it does |
|---|---|
| `:7` | `GEOFENCE_TASK` name. |
| `:9-11` | AsyncStorage keys for the inside/outside state, the enabled flag, and the event log. |
| `:12` | `MARGIN_M = 15`: hysteresis so GPS jitter at the circle's edge does not cause repeated triggers. |
| `:20-32` | `getLog` / `addLog`: keeps the 15 newest log lines. |
| `:34` | `isEnabled()`. |
| `:41-52` | `handleTransition(next, source, detail)`: the **single place** that decides a state change. It does nothing if the state is unchanged (`:43`). The first reading after monitoring starts only records the position (`:46-49`). A real change runs the `arrive` or `leave` automations (`:50`) and logs the result (`:51`). Both the native event and the foreground watcher call this. |
| `:55-62` | `evaluateFix(distance, radius)`: decides inside/outside with the 15 m margin applied from the current state, then calls `handleTransition`. |
| `:64-71` | `distanceMeters`: the haversine great-circle distance. |
| `:74-79` | `TaskManager.defineTask`: handles native Enter/Exit events. Must be at module scope (imported by `App.tsx:1`). |
| `:81-99` | `startHomeGeofence`: asks foreground (`:82-83`) then background "Allow all the time" (`:84-85`) permission, resets the remembered state (`:86`), enables monitoring (`:87`), registers the circular region (`:88-97`), and logs. |
| `:101-107` | `stopHomeGeofence`. |
| `:109` | `isGeofenceRunning()`. |

---

## 14. Native / project configuration

### `app.json`
| Lines | What it does |
|---|---|
| `:1-27` | App name, slug, icon, portrait orientation, adaptive icon, and Android package `com.anonymous.smarthomeapp`. |
| `:20-25` | Android permissions: `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`. |
| `:31-42` | Plugins: `expo-audio` (`:32`), `expo-video` (`:33`), and `expo-speech-recognition` (`:34-41`) with microphone and speech-recognition permission text and the Google speech service package for Android. |

### `package.json`
Dependencies include `expo ~58`, `react-native 0.88.1`, `react 19.3`, React Navigation 7, `expo-speech-recognition` (voice input),
`expo-speech` (spoken replies), `expo-video` (camera tiles), `expo-crypto` (password hashing), `expo-location` and
`expo-task-manager` (geofence), `react-native-maps` (map), and AsyncStorage (storage). `expo-audio` is still installed and listed as a plugin but is
**no longer used by any code** since the switch to on-device recognition.

### `.gitignore`
Excludes `node_modules`, `.expo`, generated native folders (`/android`, `/ios`), local env files (`.env`), IDE and tool folders, and keystores.

### `app.config.snippet.json`
Reference-only snippet (not read by Expo) showing Google Maps keys, background-location permissions, and a different package name
(`com.group14.smarthome`). Maps need a real Google Maps API key before the Geofence map renders tiles.

---

## 15. End-to-end flows

### 15.1 Register, then log in
1. `LoginScreen:87-95` toggles to sign-up. `submit()` (`:26`) → `useAuth().register` (`AuthContext:49`).
2. `AuthContext` calls `api.register` → `MockSmartHomeApi.register` (`mockApi.ts:164`): validate, hash with a random salt, push a `guest`, `commit()`, store the session id.
3. `AuthContext` stores the user → `Navigation:63` swaps the stack to the tabs.
4. Later, the same email and password go through `login` (`mockApi.ts:155`): re-hash with the stored salt and compare.
5. On the next app launch, `AuthContext:24-30` restores the session from `SESSION_KEY` with no password needed.

### 15.2 Voice command
1. User taps the mic (`VoiceSearchBar:81`) → `start()` (`useVoiceRecorder:34`): permission, then recognition begins.
2. User taps again → `stopAndTranscribe()` (`:51`) waits for the final result.
3. `run(heard, 'voice')` (`VoiceSearchBar:48`) → `parseCommand` (`voiceCommands.ts:67`).
4. A `device` intent calls `updateDevice` (`HomeContext:52`): optimistic update, then `api.updateDevice` (`mockApi.ts:215`), then `commit()` notifies subscribers, so every screen refreshes.
5. `feedback()` (`VoiceSearchBar:38`) shows text and speaks the confirmation with `expo-speech`.

### 15.3 Geofence automation
1. Geofence tab switch → `toggleMonitoring` (`GeofenceScreen:72`) → `startHomeGeofence` (`geofence.ts:81`).
2. The OS fires a native Enter/Exit event (`geofence.ts:74`), **or** `ForegroundGeofence` sees a new location (`:33`) → `evaluateFix` (`geofence.ts:55`).
3. Both reach `handleTransition` (`:41`) → `runAutomations` (`automations.ts:5`) → `api.updateDevice` for each action → UI refreshes through `subscribe`.

### 15.4 Camera tile
1. `CamerasScreen` filters `type === 'camera'` devices (`:52`).
2. `LiveTile` chooses a source (`:15`): `DEMO_VIDEOS[id]` → `streamUrl` → `null`.
3. The player loops muted (`:16-18`) and only exists while the tab is focused (`:68`).

---

## 16. Known limitations and gotchas

- **Local only.** Accounts and devices live in AsyncStorage on one phone. Nothing syncs between devices.
- **Demo-grade password storage.** Single salted SHA-256 (`mockApi.ts:95-97`). Use a server with bcrypt/argon2 for real use.
- **Preset passwords are in source** (`mockApi.ts:29-31`) and on the login screen (`LoginScreen:10-14`). Intentional for the demo.
- **New accounts are guests.** An admin must raise the role. The helper text at `LoginScreen:96` about "first account becomes admin" does not apply to this mock.
- **Supabase is not wired in.** `config.useSupabase` and some comments mention it, but `src/services/index.ts` always uses the mock; no Supabase client or schema is in the repo.
- **Speech recognition needs a development build** (`npx expo run:android`), not Expo Go, and depends on Google's speech services on Android.
- **`stt.ts` and `expo-audio` are unused** after the move to on-device recognition.
- **Camera clips are a single bundled file** used for both cameras; the garage and front-door tiles show identical footage.
- **Existing saved data overrides the seed.** After changing `seed()`, use *Settings → Reset demo data* to pick up the new devices.
- **Maps need an API key.** `GeofenceScreen` uses `PROVIDER_GOOGLE`; without a Google Maps key the map may be blank.
- **Node 22.11 is older than React Native 0.88 requires (22.13+).** It currently only prints a warning.
- **Android geofences below ~100 m are unreliable** (`GeofenceScreen:14`), which is why the app also runs the foreground watcher.
