# What's this?

Snap or upload a photo of anything (an animal, plant, tool, toy, car and more) and find out what it is. Every answer is saved to an archive on your device.

- **Mobile-first web app:** open it on your phone and add it to your home screen for a full-screen, app-like feel.
- **One tap:** **What's this?** opens the camera, **Upload** picks a saved photo, and **+** optionally says what type of thing it is.
- **Not it? Try again** asks again with a stronger model and skips the wrong answer.
- **Archive and settings** are in the side menu. The archive is stored on the device (IndexedDB).
- **Free-use limits** per person per day, week and month.

## How it works

```
Phone (index.html + app.js)
   │  photo, shrunk to about 1000px JPEG
   ▼
/api/identify  (Vercel serverless function)
   │  checks free-use limits (Upstash Redis)
   │  calls the AI with your API key (never sent to the phone)
   ▼
OpenAI:  GPT-5 mini (first try) · GPT-5.4 mini ("Try again")
   — or —
Claude:  Haiku 4.5 (first try) · Sonnet 5.5 ("Try again")
```

No build step and no npm packages. It's plain HTML, CSS and JavaScript plus one serverless function.

| File | What it is |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | The app |
| `api/identify.js` | Server function that talks to the AI (OpenAI or Claude) |
| `lib/usage.js` | Free-use limits |
| `manifest.webmanifest`, `icons/` | Home-screen app icon and name |
| `vercel.json` | Hosting settings |

## Deploy on Vercel

1. Import this GitHub repository at [vercel.com/new](https://vercel.com/new). Use Framework Preset **Other** and leave the build settings empty.
2. Under **Environment Variables**, add **one** AI key:
   - `OPENAI_API_KEY`, from [platform.openai.com/api-keys](https://platform.openai.com/api-keys), **or**
   - `ANTHROPIC_API_KEY`, from [console.anthropic.com](https://console.anthropic.com).

   If both are set, OpenAI is used unless you set `AI_PROVIDER` to `anthropic`.
3. Click **Deploy**.
4. Recommended: in the Vercel project, go to **Storage → Create Database → Upstash for Redis (free)** and connect it. This makes the free-use limits reliable. Then redeploy.

### Optional settings (environment variables)

| Name | Default | Meaning |
| --- | --- | --- |
| `FREE_PER_DAY` | `3` | Free photos per person per day |
| `FREE_PER_WEEK` | `21` | Free photos per person per week |
| `FREE_PER_MONTH` | `93` | Free photos per person per month |
| `AI_PROVIDER` | automatic | `openai` or `anthropic` |
| `OPENAI_MODEL_FAST` | `gpt-5-mini` | OpenAI model for the first try |
| `OPENAI_MODEL_STRONG` | `gpt-5.4-mini` | OpenAI model for "Try again" |
| `CLAUDE_MODEL_FAST` | `claude-haiku-4-5-20251001` | Claude model for the first try |
| `CLAUDE_MODEL_STRONG` | `claude-sonnet-5-5` | Claude model for "Try again" |

A person is counted by an anonymous ID stored in their browser, plus a looser limit per network (3× the numbers above). Limits reset at the person's local midnight, on Mondays, and on the 1st of the month.

## Costs

- GitHub and Vercel Hobby: free for personal, non-commercial projects.
- Upstash Redis: free tier.
- AI: well under a cent per photo on the default models. Set a monthly spend limit in your OpenAI or Anthropic account.
- With the default 3 free photos a day, one very active person costs at most about 90 photos a month.

## Privacy

Photos are sent to the server only to be identified and are not stored there. The archive stays on the user's device. The app won't say who a person is.
