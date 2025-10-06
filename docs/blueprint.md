# **App Name**: Goal Stack

## Core Features:

- User Authentication: Implements user sign-up and sign-in using existing authentication in the 'studio-3417145591-24d0a' Firebase project. Integrates with Firestore security rules already set up to ensure proper authentication and authorization.
- Matches Tab: Displays 'My Results' (favorited matches based on team or competition) and 'All Matches' (filtered important leagues/cups). Includes optional filters.
- Competitions Tab: Lists competitions by continent. Each competition shows matches, standings, top scorers, and teams. Supports favoriting competitions.
- Iraq Tab: Contains 'Our League' (matches, standings, top scorers), 'Predictions' (initial UI), and 'OurCard' (favorite local teams with player notes).
- Admin Control Panel: Allows admin users to add, delete, and edit competitions, teams, news, and update top scorer standings via API Football using API key 'e931ffb3ccda478e60b74c6e36913c90'. Admin authentication is managed via Firestore.
- Real-time Data Sync: Listens for updates using onSnapshot for important changes. The frontend uses caching strategy with stale-while-revalidate strategy for speed.
- Keep-Alive Navigation: Implements navigation with screens kept mounted in memory to maintain app states, by leveraging React's absolute positioning with zIndex

## Style Guidelines:

- Primary color: A vibrant blue (#29ABE2) reflecting the energy of sports and the sky, fitting for a mobile application.
- Background color: A desaturated light blue (#E5F5F9) for a clean, modern look that complements the primary color.
- Accent color: An analogous color, cyan (#29E2D9) providing a pop of contrast and drawing attention to interactive elements.
- Body and headline font: 'Inter' sans-serif font for a clean, neutral and modern look, that is very readable on mobile screens.
- Simple, clear icons for navigation and key actions. Icons should be consistent and easily recognizable.
- Mobile-first layout with touch-friendly components and clear information hierarchy. Avoid WebView components in favor of native UI elements for key features.
- Subtle animations (e.g., sliding transitions) for a smooth and engaging user experience. Ensure animations are performant on mobile devices.