# Expo Go Testing Notes

## Tested Environments
- **Expo SDK**: 52.0.37
- **React Native**: 0.76.9
- **Platforms Tested**: iOS Simulator, Android Emulator

## Working Features in Expo Go

### ✅ Fully Functional
- **Navigation**: Expo Router with file-based routing works perfectly
- **Authentication**: Guest session creation, sign in, registration, token storage
- **Camera Capture**: `expo-camera` with permission handling, flash/torch, zoom
- **Gallery/Document Import**: `expo-image-picker` and `expo-document-picker`
- **Image Processing**: `expo-image-manipulator` for client-side compression/resize
- **Network**: Axios with interceptors, TanStack Query for caching
- **UI**: React Native Paper + NativeWind v2 (Tailwind-like styling)
- **Internationalization**: i18next with Thai (default) + English
- **Fonts**: Noto Sans Thai via `@expo-google-fonts/noto-sans-thai`
- **Storage**: `@react-native-async-storage/async-storage` for preferences
- **Secure Storage**: `expo-secure-store` for refresh tokens
- **Haptics**: `expo-haptics` for tactile feedback
- **Blur Effects**: `expo-blur` for glassmorphism (progressive enhancement)

### ⚠️ Limitations in Expo Go
1. **Background Tasks**: Not supported - job polling only works while app is foregrounded
2. **Push Notifications**: Not available without EAS Build / standalone app
3. **Custom Native Modules**: Any native code requires EAS Build or prebuild
4. **File System Access**: Limited to app sandbox - use `expo-file-system` APIs
5. **Bluetooth/Low-level Hardware**: Not available

## Known Issues & Workarounds

### Camera Permissions
- First launch requires manual permission grant in system settings
- Handle gracefully with `PermissionsModal` component

### Large File Uploads
- Client-side compression reduces images to ~2MB max
- Use `onUploadProgress` for progress indication
- Timeout set to 180s for multipart uploads

### Text Extraction (OCR)
- Backend processes OCR asynchronously via jobs
- Polling interval: 1.5s → 4s after 30s
- Show extraction status badges (validating → extracting_text → ready/partial/failed)

### Thai Typography
- Noto Sans Thai loads correctly via `expo-font`
- Line heights adjusted for Thai ascenders/descenders
- Use `fontFamily: 'NotoSansThai'` in NativeWind config

### Fixture Mode
- `EXPO_PUBLIC_FIXTURE_MODE=true` enables mock data
- Persistent banner: "ข้อมูลจำลองเพื่อการทดสอบ" (Test Fixture Data)
- All API calls return simulated responses
- Useful for UI development without backend

## Testing Checklist

### Onboarding Flow
- [ ] Welcome screen displays with Thai/English toggle
- [ ] Language selection persists via AsyncStorage
- [ ] Consent screen shows AI processing agreement
- [ ] Accept consent → creates guest session → navigates to Home

### Home Dashboard
- [ ] Quick actions: Scan Document, Import Files, Ask Tiw
- [ ] Recent materials display with thumbnails
- [ ] Due flashcard count badge
- [ ] Fixture banner visible when enabled

### Capture Flow
- [ ] Camera opens with overlay guidelines
- [ ] Flash toggle works
- [ ] Multi-page capture (add page button)
- [ ] Review screen: reorder, delete, retake pages
- [ ] Upload with progress indicator
- [ ] Success → navigates to Source detail

### Import Flow
- [ ] Image picker: multi-select from gallery
- [ ] Document picker: PDF, DOCX, TXT
- [ ] Upload with progress
- [ ] Success → Source detail

### Source Processing
- [ ] Source detail shows extraction status
- [ ] Stages: validating → normalizing → extracting → chunking → finalizing
- [ ] Text preview tab shows extracted chunks
- [ ] Retry button for failed/partial extractions
- [ ] Generate material button enabled when ready

### Material Generation
- [ ] Summary generation with job polling
- [ ] Flashcards generation
- [ ] Quiz generation
- [ ] Material detail shows tabs: Summary / Flashcards / Quiz
- [ ] Fixture mode shows mock generated content

### Study Sessions
- [ ] Flashcards: SM-2 algorithm, 4-button rating
- [ ] Quiz: multiple choice, true/false, short answer
- [ ] Progress indicator, question counter
- [ ] Results screen with score, review missed items
- [ ] Session saved to history

### Chat (Nong Tiw)
- [ ] Conversation list with source context badges
- [ ] New chat with/without source grounding
- [ ] Streaming responses (or simulated)
- [ ] Citations with source reference chips
- [ ] Follow-up suggestions

### Library
- [ ] Tabs: Sources / Materials / Saved
- [ ] Search and filter by status/kind
- [ ] Star/unstar items
- [ ] Swipe actions: delete, retry

### History
- [ ] Recent study sessions with scores
- [ ] Active/failed jobs with cancel/retry
- [ ] Pull-to-refresh

### Settings
- [ ] UI Language (Thai/English) - immediate effect
- [ ] Content Language (Auto/Thai/English)
- [ ] Education Level
- [ ] Theme (System/Light/Dark)
- [ ] Account status (Guest/Registered)
- [ ] Upgrade/Sign In/Register flow
- [ ] Consent management
- [ ] Delete all data (with confirmation)

## Performance Notes
- Initial load: ~3-5s on cold start (font loading, bundle)
- Navigation transitions: 60fps with React Native Screens
- Image compression: ~200-500ms per photo
- Job polling: minimal battery impact (1.5s interval)

## Debugging Tips
- Use `console.log` - visible in Metro terminal
- React Native Debugger / Flipper for Redux/Query inspection
- Network tab in Chrome DevTools for API calls
- `expo-doctor` validates configuration

## Build for Production
```bash
# EAS Build (recommended)
eas build --platform all

# Or local prebuild
npx expo prebuild
# Then build with Xcode / Android Studio
```