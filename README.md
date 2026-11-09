# MessMate 🍛 — IIIT Mess Management

MessMate is a crayon-art styled web app for IIIT students and the mess office. Students check menus, mark attendance, rate food, trade meal coupons, post in a community feed and raise complaints. The mess admin manages menus, notices, check-in codes and complaints, and sees how many people to cook for.

**Stack:** React 18 (Vite) frontend · Express (Node.js) REST API · **SQLite** database (Node's built-in `node:sqlite`, so there's no native module to compile and no database server to install).

---

## 1. Quick start

**Requirements:** Node.js **22.13 or newer** (it has built-in SQLite). Check with `node -v`.

```bash
npm run setup     # first time only: installs root, server and client dependencies
npm run dev       # API on http://localhost:5050 + web app on http://localhost:5173
```

Open **http://localhost:5173**.

| Command | What it does |
|---|---|
| `npm run setup` | Install all dependencies (root, `server/`, `client/`) |
| `npm run dev` | Run API (auto-restarts on change) and the Vite dev server together |
| `npm start` | Production mode: builds the React app and serves everything from http://localhost:5050 |
| `npm run build` | Build the client only (`client/dist`) |
| `npm run reset` | Delete the SQLite database. A fresh demo database is seeded on the next start |

### Demo accounts
Password for all: **`password123`**. The login page also has one-click demo buttons.

| Email | Role |
|---|---|
| `aarav@iiit.ac.in` | Student (also `diya@`, `kabir@`, `ananya@`, `vihaan@`, `ishita@`, `rohan@` …`iiit.ac.in`) |
| `admin@iiit.ac.in` | Mess admin (unlocks **Mess control**) |

### Environment variables (all optional)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5050` | API port |
| `DB_FILE` | `server/data/messmate.db` | Path of the SQLite database file |
| `APP_SECRET` | dev value | Secret used to generate the rotating check-in codes. **Set it in production** |
| `STRICT_HOURS` | off | Set to `1` to allow check-ins only during real meal hours |

---

## 2. Features and how they work

### 🔐 Accounts, login and logout
- **Sign up** with name, college email, roll number, hostel and password (6+ characters). New students get a ₹500 welcome balance in their wallet.
- **Log in** with email and password. Email matching ignores case. Passwords are stored as salted **scrypt** hashes, never in plain text.
- **Sessions:** a successful login creates a row in the `sessions` table and gives the browser a random token. The database stores only the token's SHA-256 hash. Sessions last 30 days.
- **Log out** is available in three places: the 🚪 button in the top bar (visible on phones too), the "log out" button in the sidebar, and the Profile page. Logging out **deletes the session on the server**, so the token stops working immediately. It is not just cleared from the browser.
- **Log out everywhere** (Profile page) ends the sessions on all your devices.
- **Change password** (Profile page) checks your current password, saves the new one and logs out your other devices.

### 🏠 Home
A live "now serving" card with a countdown to the next meal, a spinning 3D thali of today's dishes, a **rush meter** (how busy the mess is right now, based on check-ins in the last 15 minutes) and your current streak.

### ✅ Attendance
- **Check in** by typing the 6-character code shown on the mess screen. The code is derived from `APP_SECRET` and the time and **rotates every 30 seconds**, so a code shared over WhatsApp expires quickly (no proxies). A check-in counts once per student per meal.
- A 5-week heatmap, per-meal counts and your attendance percentage for the last 30 days.
- **Skip a meal in advance (opt out).** This lowers the admin's "cook for" count so less food is wasted, and earns XP.

### 🍛 Menu
- Weekly menu for all 4 meals (breakfast, lunch, snacks, dinner).
- **Rate today's meals** with 1–5 stars and a vibe (🔥 bussin … 💀 crime). Rating again updates your earlier rating. Average ratings are shown per meal.
- **Dish wishlist:** suggest a dish and upvote others' suggestions, sorted by votes.

### 📢 Notices
The admin posts announcements with a tag (event, important, update) and can pin or delete them. Everyone can react with emoji.

### 💬 Community
Posts and **polls** (2–5 options; you can change your vote), upvotes, comments and tags (food-review, meme, lost-found…). Sort by new or top. Authors and the admin can delete posts.

### 🎟️ Coupon bazaar and wallet
- **Sell** a meal you'll skip. The price is capped at the mess price, so nobody can scalp. You can't list a meal you already ate.
- **Buy** someone's coupon with your wallet balance. The purchase runs in a single **database transaction**: your wallet is debited, the seller is credited, the coupon is marked sold and both transaction records are written, or none of it happens. Two people can't buy the same coupon.
- Selling a coupon automatically counts the seller as an opt-out for food planning.
- Wallet top-up (₹1–₹2000) and a history of your last 30 transactions.

### 🗣️ Speak up (complaints)
Raise complaints by category, with an **anonymous mode**: other students see "Anonymous", while the admin can still see the author. Students can "me too" upvote. The admin sets the status (open → in-progress → resolved) and writes a reply.

### 🏆 Leaderboard and badges
You earn XP for activity: check-in +10 (+50 bonus every 7-day streak), rating +5, post +3, complaint +2, opt-out +2, coupon sold +5. The leaderboard has a 3D podium. Badges (Early Bird, Food Critic, Hustler, Zero Waste, Mess Legend…) appear on your profile.

### 👨‍🍳 Mess control (admin only)
The live rotating check-in code to display at the entrance, today's per-meal **"cook for" counts** (students minus opt-outs) plus tomorrow's estimate, a 7-day attendance and rating chart, and a menu editor.

### 🔍 Search and themes
- Press **⌘K / Ctrl+K** to search menus, notices, posts, coupons, complaints and people.
- 🖍️ Paper and 📄 chalkboard (dark) themes. Phones get a bottom navigation bar.

---

## 3. Database (SQLite)

The database is a single file, **`server/data/messmate.db`**, created automatically on first start (WAL mode, foreign keys on). It is git-ignored.

**First start:**
- If an old `server/data/db.json` (from the previous JSON-file version) exists, all its data is **imported automatically**. The file is then renamed to `db.json.migrated` and kept as a backup.
- Otherwise the database is **seeded with demo data**: 8 users, a full week's menu, two weeks of attendance and ratings, notices, posts, coupons and complaints.

To start from a clean demo database: stop the server, run `npm run reset`, then start it again.

### Tables

| Table | Stores |
|---|---|
| `users` | Students and admins: profile, role, scrypt password hash, wallet balance, XP |
| `sessions` | One row per logged-in device (SHA-256 of the token, expiry). Deleted on logout |
| `menu_items` | Weekly menu: one row per dish (`day`, `meal`, `position`, `name`) |
| `attendance` | Check-ins. `UNIQUE(user_id, date, meal)` prevents double check-ins |
| `optouts` | Meals a student will skip |
| `ratings` | Star rating, vibe and comment. One per user per meal per day |
| `coupons` | Meal coupons listed for sale: seller, buyer, price, status (`listed`/`sold`/`cancelled`) |
| `transactions` | Wallet history (top-ups, coupon purchases and sales, welcome bonus) |
| `announcements`, `announcement_reactions` | Notices and their emoji reactions |
| `posts`, `post_upvotes`, `comments`, `poll_options`, `poll_votes` | Community feed |
| `complaints`, `complaint_upvotes` | Speak-up complaints and "me too" votes |
| `wishlist`, `wishlist_votes` | Dish suggestions and votes |

Foreign keys use `ON DELETE CASCADE`, so deleting a post also removes its comments, upvotes and poll data. `CHECK` constraints guard values such as the meal name, 1–5 stars, a non-negative wallet and valid statuses.

To browse the data, use any SQLite viewer (e.g. *DB Browser for SQLite*, or the VS Code "SQLite Viewer" extension) or the CLI:
```bash
sqlite3 server/data/messmate.db ".tables"
sqlite3 server/data/messmate.db "SELECT name, email, wallet, xp FROM users ORDER BY xp DESC;"
```

---

## 4. REST API

All routes are under `/api`. Every route except register, login and health needs the header `Authorization: Bearer <token>`. Errors come back as `{ "error": "message" }` with a matching HTTP status.

| Method & path | Who | Description |
|---|---|---|
| `POST /auth/register` | public | Create account → `{ token, user }` |
| `POST /auth/login` | public | Log in → `{ token, user }` |
| `POST /auth/logout` | user | End this session |
| `POST /auth/logout-all` | user | End all of this user's sessions |
| `GET /auth/sessions` | user | List active sessions |
| `POST /auth/password` | user | Change password `{ currentPassword, newPassword }` |
| `GET /me` · `PATCH /me` | user | Profile, streak and badges · update name/avatar/hostel/bio |
| `GET /menu` | user | Week menu, today's meals with ratings, current/next meal |
| `PUT /menu/:day` | admin | Replace a day's dishes `{ breakfast: [...], lunch: [...] }` |
| `POST /menu/rate` | user | Rate a meal today `{ meal, stars, vibe }` |
| `GET/POST /menu/wishlist` · `POST /menu/wishlist/:id/vote` | user | Dish wishlist, toggle vote |
| `POST /attendance/checkin` | user | Check in `{ code }` |
| `GET /attendance/me` | user | Your stats, heatmap data, upcoming opt-outs |
| `POST /attendance/optout` | user | Toggle skipping `{ date, meal }` |
| `GET /attendance/live` | user | Rush meter |
| `GET /attendance/code` | admin | Current rotating check-in code |
| `GET /wallet` · `POST /wallet/topup` | user | Balance and history · add money `{ amount }` |
| `GET /coupons` · `POST /coupons` | user | Marketplace and your coupons · list one `{ date, meal, price, note }` |
| `POST /coupons/:id/buy` · `POST /coupons/:id/cancel` | user | Buy · cancel your listing |
| `GET /announcements` · `POST` · `PATCH /:id` · `DELETE /:id` | user / admin | Notices (create, pin and delete are admin only) |
| `POST /announcements/:id/react` | user | Toggle emoji reaction |
| `GET /posts?tag=&sort=new\|top` · `POST /posts` | user | Feed · new post or poll `{ content, tag, pollOptions }` |
| `POST /posts/:id/upvote` · `/vote` · `/comments` · `DELETE /posts/:id` | user | Interact with posts |
| `GET /complaints` · `POST /complaints` · `POST /complaints/:id/upvote` | user | Complaints |
| `PATCH /complaints/:id` | admin | Set `status` / `response` |
| `GET /leaderboard` | user | XP ranking |
| `GET /search?q=` | user | Global search |
| `GET /admin/stats` | admin | Cook-for counts, 7-day trend, totals |
| `GET /health` | public | Health check |

---

## 5. Project structure

```
package.json            root scripts (setup, dev, start, reset)
server/
  index.js              Express app, error handler, serves client/dist in production
  db.js                 SQLite connection, schema (CREATE TABLE …), JSON import, demo seed, query helpers
  auth.js               session auth middleware, admin guard, user mapping
  utils.js              meal times, password hashing, rotating check-in code
  routes/core.js        auth/logout, profile, menu, attendance, wallet, coupons
  routes/social.js      notices, community, complaints, leaderboard, search, admin stats
  data/messmate.db      the SQLite database (auto-created, git-ignored)
client/
  src/api.js            fetch wrapper (adds the token; logs out on 401)
  src/store.jsx         app state: user, login, logout, toasts
  src/App.jsx           routes (admin route only for admins)
  src/pages/*           Home, Menu, Attendance, Notices, Community, Coupons, SpeakUp, Leaderboard, Profile, Admin, Login
  src/components/*      Layout (sidebar, top bar, logout), search palette, 3D thali, form controls
  src/crayon/*          hand-drawn SVG look (see below)
```

## 6. How the crayon look works

Everything is drawn with hand-written SVG, with no UI kit or images:
- `client/src/crayon/paths.js`: seeded wobbly outlines, lumpy shapes and zigzag "colouring-in" fills
- `client/src/crayon/Filters.jsx`: SVG turbulence filters for wax grain, plus a "boiling line" filter that animates like hand-drawn frames
- `client/src/crayon/Sketch.jsx`: `<Sketch>` draws a crayon box around any content; also crayon buttons, stickers, stars and scribble underlines
- `client/src/crayon/Doodles.jsx`: crayon food illustrations (chai, samosa, dosa, biryani, jalebi, momos…)
- `client/src/components/Thali3D.jsx`: CSS-3D lazy susan; drag it to spin it
- Motion uses framer-motion springs: cards are dealt in, pages are laid down like paper, buttons wiggle

Outside meal hours, check-ins count toward the nearest meal so the demo always works. Set `STRICT_HOURS=1` to require real meal times.
