// The single place for the app's name, tagline and links.
// Rename the app by editing this file (plus <title> in index.html).
export const site = {
  name: "Mempo",
  tagline: "Make words stick!",
  description: "Your little companion for learning words.",
  repoUrl: "https://github.com/GrowingRui/Mempo",
  appUrl: "https://mempo.vercel.app",
  // Daily reminders (web push): the public half of the key pair. The private half is VAPID_PRIVATE_KEY
  // on Vercel (and in .env.local). Changing the pair cuts off every reminder already turned on.
  vapidPublicKey: "BMhBIKnghu4HzXgeNCoUhKOs7zhyTI1mfUGbAGqfzm_s19AKcCmo4oFtpewWGZ7kXCN2gv6073hmyY3jAIIwwDc",
  // Where "Send feedback" goes. Kept in two parts so bots reading the page don't find the address.
  // The server has its own copy (api/feedback.ts).
  feedbackMail: ["xiarui091", "gmail.com"],
  // Exam practice → "Official sample papers": Cambridge's free preparation pages (sample tests online
  // and to download). We link to them; their papers are copyrighted, so we never copy them.
  samplePapers: {
    B2: "https://www.cambridgeenglish.org/exams-and-tests/qualifications/first/preparation/",
    C1: "https://www.cambridgeenglish.org/exams-and-tests/qualifications/advanced/preparation/",
    C2: "https://www.cambridgeenglish.org/exams-and-tests/qualifications/proficiency/preparation/",
  },
  // Prefix for localStorage keys. Changing it starts everyone with empty progress.
  storageKey: "mempo",
} as const;
