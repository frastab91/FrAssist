# Rally NYC Project Growth Context & Memory
Last Updated: 2026-04-28

## Current State
- **Project**: Rally NYC
- **Database**: Supabase (oylhowvuhatfiyejjhwd)
- **Current User Count (Profiles)**: 29
- **Goal**: 1,000 Users
- **Target Timeline**: 14 Days (by 2026-05-12)
- **Remaining to Acquire**: 971

## Persistence Log
- **Initial Schema Discovery**: Successful. 
- **Verified Tables**: `profiles`, `parks`, `crowd_reports`, `player_posts`, `court_sessions`, `messages`, `push_subscriptions`, `user_preferred_parks`, `user_time_windows`.
- **Note**: There is NO `users_view` in this project. Use `profiles` for user data.
- **Initial User Count**: 29

## Future Iteration Notes
- Future sub-agents must query the `profiles` table to track growth.
- The growth strategy is defined in `/Users/francescoclaw/.gemini/antigravity/scratch/personal-assistant/backend/growth_plan.md`.
- All interactions should utilize the `rally-nyc` Supabase credentials.
