// English: the app's own texts (buttons, hints, messages). The other languages (zh.tsx, es.tsx) must have the
// same keys with the same parameters; TypeScript checks it (`Messages` below).
// Word content on the cards (meanings, definitions, examples, sensitive-word notes) is not here.
import type { ReactNode } from "react";
import { site } from "../config/site";
import { joinList, longDate, numberIn, addDays, shortDate } from "./format";

const locale = "en-GB";
const N = numberIn(locale);
const plural = (n: number, one: string, many: string) => `${N(n)} ${n === 1 ? one : many}`;
const words = (n: number) => plural(n, "word", "words");
/** Keeps "Don’t know" on one line. */
const nb = (s: string) => s.replace(/ /g, " ");
const b = (x: ReactNode) => <b className="text-ink">{x}</b>;

export interface InstallIcons {
  share: ReactNode;
  add: ReactNode;
  menu: ReactNode;
}

const en = {
  locale,
  num: N,

  common: {
    words,
    days: (n: number) => plural(n, "day", "days"),
    loadingWords: "Loading words…",
    loadFailed: (level: string) => `Couldn’t load the ${level} words. Check your connection and try again.`,
    backToHome: "Back to home",
    back: "Back",
    cancel: "Cancel",
    close: "Close",
    done: "Done",
    next: "Next",
    save: "Save",
    install: "Install",
    iDontKnow: "I don’t know",
    somethingWrong: "Something went wrong. Try again.",
  },

  /** "today", "tomorrow" or "on Tue 10 Nov", for a day in the future. */
  when: (day: string, today: string) => (day <= today ? "today" : day === addDays(today, 1) ? "tomorrow" : `on ${shortDate(day, locale)}`),
  /** "Today", "Yesterday" or "Fri 6 Nov", for a day in the past. */
  pastDay: (day: string, today: string) => (day === today ? "Today" : day === addDays(today, -1) ? "Yesterday" : shortDate(day, locale)),

  answer: { know: "Know", unsure: "Not sure", dontknow: "Don’t know" },
  status: { new: "New", learning: "Learning", review: "Reviewing", mastered: "Mastered", dontknow: "Don’t know" },
  levelName: { B2: "Upper-intermediate", C1: "Advanced", C2: "Proficiency" },
  pos: {
    n: "noun", v: "verb", adj: "adjective", adv: "adverb", prep: "preposition", conj: "conjunction", pron: "pronoun",
    interj: "interjection", num: "number", det: "determiner", phr: "phrase", abbr: "abbreviation",
  } as Record<string, string>,

  nav: {
    aria: "Main",
    today: "Today",
    practice: "Practice",
    words: "Words",
    stats: "Stats",
    settings: "Settings",
  },

  practice: {
    title: "Practice",
    intro: "Extra ways to learn, next to your daily session.",
    dontKnowSub: "Keep practising the words you missed",
    testTitle: "Level test",
    testSub: "Not sure about your level? Find out in a few minutes",
  },

  home: {
    tagline: site.tagline as string,
    statsAria: (streak: number) => `Stats. Streak: ${plural(streak, "day", "days")}`,
    todayAria: "Today",
    ofNewToday: (goal: number) => `of ${goal} new words today`,
    seenIn: (level: string, seen: ReactNode, total: number) => (
      <>
        Seen in {level}: {seen} of {N(total)} words
      </>
    ),
    practiceAria: "Practice",
    reviewsDue: "Reviews due",
    allWords: "All words",
    recall: "Recall",
    recallSub: "Test yourself on words you’ve studied",
    exam: "Exam practice",
    examSub: "Cambridge exam tasks: multiple-choice cloze, word formation",
    skip: "Skip words you know",
    skipSub: "Tick off easy words so they don’t come up",
    wotd: "Word of the day",
    morePractice: "More practice",
    yourPlan: "Your plan",
    change: "Change",
    planGoal: (goal: number) => `${N(goal)} new a day`,
    yourLevel: "Your level",
    takeTest: "Not sure? Take a level test",
    levelAria: "Level",
    goalTitle: "New words per day",
    custom: "Custom",
    goalInputAria: "Your own number of new words per day",
    wordsADay: "words a day",
    goalRange: (min: number, max: number) => `Choose a number from ${min} to ${max}.`,
    start: "Start",
    keepGoing: "Keep going",
    breakdown: (reviews: number, dontKnow: number, fresh: number) =>
      joinList(
        [reviews ? plural(reviews, "review", "reviews") : "", dontKnow ? `${N(dontKnow)} don’t know` : "", fresh ? `${N(fresh)} new` : ""].filter(Boolean),
        " and ",
      ),
    allSeen: (level: string) => `You’ve seen every ${level} word. Try another level!`,
    allDone: "All done for today. See you tomorrow!",
    heldBack: (n: number, limit: number) => `${plural(n, "more review", "more reviews")} ${n === 1 ? "waits" : "wait"} for the next days (limit: ${limit} a day).`,
    savedHere: "Your progress is saved in this browser.",
  },

  study: {
    empty: {
      today: "Nothing left to study today.",
      review: "No reviews due right now.",
      dontknow: "Your “Don’t know” list is empty. Nice!",
    },
    niceWork: "Nice work!",
    wentThrough: (n: number) => `You went through ${words(n)}.`,
    knew: "knew",
    notSure: "not sure",
    didntKnow: "didn’t know",
    cameBack: "Every word came back until you knew it.",
    nextReview: (when: string, count: ReactNode) => (
      <>
        Next review {when}: {count}
      </>
    ),
    left: (n: number) => `${n} left`,
    newWord: "New word",
    review: "Review",
    onceMore: ", once more",
    swipeHint: (left: string, right: string) => `Swipe or use arrow keys: ← ${nb(left)}, ↑ Not sure, → ${nb(right)}`,
  },

  card: {
    offensive: "Offensive",
    offensiveWord: "Offensive word",
    useWithCare: "Use with care",
    alsoSpelled: (v: string) => `Also spelled ${v}.`,
    forms: (f: string) => `Forms: ${f}`,
    showWord: "Show the word",
    showMeaning: "Show the meaning",
    tapToFlip: "Tap the card to see the meaning",
    reportLink: "Wrong translation? Report it",
    hear: (w: string) => `Hear “${w}”`,
    nextReviewStep: (when: string, box: number, max: number) => `Next review ${when}, step ${box} of ${max}`,
  },

  recall: {
    title: "Recall",
    intro: (round: number) => `Test yourself on words you’ve already studied, weakest first. ${round} words a round. Your review schedule isn’t changed.`,
    studyFirst: "Study a few words first",
    studyFirstSub: "Recall asks words you’ve already seen. Do today’s session, then come back!",
    startStudying: "Start studying",
    kinds: {
      meaning: { title: "Meaning → word", sub: "Read the translation, pick the English word." },
      listen: { title: "Listen → word", sub: "Hear the word, pick how it’s written." },
      spell: { title: "Spell it", sub: "Read the translation and type the word. The hardest one!" },
      cloze: { title: "Multiple-choice cloze", sub: "Four words with a close meaning. Only one fits the gap." },
      form: { title: "Word formation", sub: "Change the word in capitals so it fits the sentence." },
    },
    toPractise: (n: number) => `${plural(n, "studied word", "studied words")} to practise.`,
    roundDone: "Round done",
    perfect: "Perfect round!",
    rightAnswers: "right answers",
    missed: "Missed",
    alreadyListed: (n: number) => `${n === 1 ? "It’s" : "They’re"} already on your “Don’t know” list.`,
    added: "Added to your “Don’t know” list.",
    addThese: (n: number) => `Add ${n === 1 ? "it" : `these ${n}`} to “Don’t know”`,
    anotherRound: "Another round",
    otherExercise: "Other exercise",
    stopRound: "Stop this round",
    playAgain: "Play the word again",
    tapToHear: "Tap to hear it again",
    startsWith: (letter: string, len: number) => `Starts with ${letter}, ${len} letters`,
    typeAria: "Type the English word",
    typePlaceholder: "Type the word…",
    showAnswer: "Show answer",
    check: "Check",
    almost: "Almost! Check the spelling:",
    theAnswer: "The answer:",
    whichHeard: "Which word did you hear?",
    whichIs: "Which word is it?",
    formPrompt: "Use the word in capitals to make a word that fits the gap.",
    formAria: "Type the word that fits the gap",
    wrongForm: "Right word, wrong form. The gap needs:",
  },

  exam: {
    title: "Exam practice",
    intro: "Tasks from the Cambridge Reading and Use of English paper (B2 First, C1 Advanced, C2 Proficiency). They can include words you haven’t studied yet. Your review schedule isn’t changed.",
    clozePrompt: "Only one of the four words fits this sentence.",
    whichFits: "Which word fits the gap?",
    why: "Why:",
    part: (n: number) => `Part ${n}`,
  },

  test: {
    title: "Level test",
    question: "What’s your level?",
    intro: (n: number) => `${n} random words from B2, C1 and C2. Pick the right meaning, or tap “I don’t know”. No guessing, so the result is honest!`,
    answerIn: "Answer in",
    answerLangAria: "Answer language",
    start: "Start the test",
    about: "About 3 minutes. Your learning progress isn’t changed.",
    resultTitle: "Your result",
    weSuggest: "We suggest you learn",
    rightOf: (right: number, total: number) => `${right} of ${total} right`,
    probablyKnow: (known: ReactNode, total: number) => (
      <>
        you probably know about {known} of {N(total)} words
      </>
    ),
    passNote: (pct: number) => `You “know” a level at ${pct}% or more. We suggest the first level below that.`,
    already: (level: string) => `${level} is already your level. Nice!`,
    switchTo: (level: string) => `Switch my level to ${level}`,
    again: "Test again",
    backHome: "Back home",
    keep: (level: string) => `Keep ${level}`,
    stop: "Stop the test",
    whatMeans: "What does it mean?",
  },

  skip: {
    title: "Skip words you know",
    intro: (level: string) => `The next new ${level} words. Tap the ones you already know well.`,
    tickAll: "Tick all",
    clear: "Clear",
    ticked: (n: number) => `${words(n)} ticked`,
    check: (n: number) => `Check ${n === 1 ? "it" : `these ${N(n)}`}`,
    checkNote: "A few quick questions on the words you ticked, to make sure.",
    showNext: "Show the next 20",
    untickedNote: "Words you don’t tick stay in your study list.",
    noneLeft: (level: string) => `No more new ${level} words to show.`,
    stop: "Stop the check",
    resultTitle: "Done",
    skipped: (n: number) => `${words(n)} skipped`,
    checkScore: (right: number, asked: number) => `${right} of ${asked} right in the check.`,
    passedNote: "They won’t come up as new words. Each comes back once in about two months for a quick check.",
    failedNote: (kept: number) =>
      `Not quite sure yet, so only the words you answered right were skipped. The other ${words(kept)} stay in your study list.`,
    missedNote: (kept: number) => `${kept === 1 ? "The word" : `The ${N(kept)} words`} you missed stay in your study list.`,
    next: "Next 20 words",
    undo: "Undo",
    undone: "Undone. The words are new again.",
  },

  stats: {
    title: "Stats",
    streakAria: "Streak",
    dayStreak: (_n: number) => "day streak",
    studiedToday: "You studied today. See you tomorrow!",
    keepItGoing: "Study today to keep it going.",
    startStreak: "Study today to start a streak.",
    longest: (days: ReactNode) => <>Longest: {days}</>,
    wordsSeen: "Words seen",
    mastered: "Mastered",
    daysStudied: "Days studied",
    lastDays: (n: number) => `Last ${n} days`,
    new: "New",
    reviewed: "Reviewed",
    dayLine: (fresh: number, reviewed: number) => `${fresh} new, ${reviewed} reviewed`,
    tapDay: "Tap a day to see its numbers.",
    nothingYet: "Nothing yet. Your days will show up here.",
    tableCaption: (n: number) => `Words per day, last ${n} days`,
    day: "Day",
    byLevel: "By level",
    notSeen: "Not seen",
    seenOf: (seen: ReactNode, total: number) => (
      <>
        {seen} of {N(total)} seen
      </>
    ),
    segment: (n: number, label: string) => `${N(n)} ${label.toLocaleLowerCase(locale)}`,
    reviewsTotal: (n: number) => `${plural(n, "review", "reviews")} done in total.`,
  },

  dontKnow: {
    intro: (days: number) => `Words you swiped “Don’t know”. A word leaves this list after you know it ${days} days in a row.`,
    allClear: "All clear!",
    empty: "No words on your “Don’t know” list.",
    practise: (n: number) => (n === 1 ? "Practise this word" : `Practise these ${n} words`),
  },

  wordList: {
    title: "Word list",
    search: "Search English, 中文 or español",
    searchAria: "Search words",
    allLevels: "All levels",
    anyStatus: "Any status",
    levelAria: "Level",
    statusAria: "Status",
    noMatch: "No words match. Try fewer letters or another filter.",
    showMore: (n: number) => `Show more (${N(n)} left)`,
  },

  settings: {
    title: "Settings",
    language: "Language",
    languageHint: "For buttons and messages. The meanings on the cards are set under “Meanings”.",
    theme: "Theme",
    themeHint: "Auto follows your phone or computer.",
    themes: { light: "Light", dark: "Dark", system: "Auto" },
    meanings: "Meanings",
    meaningsHint: "Shown on the back of the card and in the word lists.",
    zhSub: "Chinese",
    esSub: "Spanish",
    oneStaysOn: "Chinese or Spanish: at least one stays on.",
    enSub: "Definitions in English",
    swiping: "Swiping",
    swipingHint: "Swipe up is always “Not sure”. The buttons follow the same order.",
    swipeAria: "Swipe direction",
    knowOnLeft: "Know on the left",
    knowOnRight: "Know on the right",
    reviewsPerDay: "Reviews per day",
    reviewsHint: "After a break, the oldest reviews come first and the rest wait for the next days. “Reviews due” on Home still lets you do them all.",
    noLimit: "No limit",
    reminder: "Daily reminder",
    offline: "Offline",
    offlineHint: `Once loaded, ${site.name} works without internet.`,
    move: "Move to another device",
    moveHint: "Copy your progress to another phone, tablet or browser with a QR code.",
    progress: "Your progress",
    progressHint: "Saved in this browser only. Download a backup to keep it safe.",
    download: "Download backup",
    downloaded: "Backup downloaded.",
    restore: "Restore backup",
    readFailed: "Couldn’t read this file.",
    startOver: "Start over",
    nothingToDelete: "Nothing to delete yet.",
    startOverNote: "Deletes all your words and daily history. Your settings stay.",
    feedback: "Feedback",
    feedbackHint: "Found a problem, or have an idea? Tell us. It goes straight to the developer.",
    sendFeedback: "Send feedback",
    privacy: "Privacy",
    usage: "Anonymous usage counts",
    usageSub: `Once a day, tells the developer this device opened or studied in ${site.name}. A random number, nothing about you or your words.`,
    restoreTitle: "Restore this backup?",
    moveTitle: "Bring over this progress?",
    replace: "Replace my progress",
    moved: (n: number) => `Progress moved: ${words(n)}.`,
    restored: (n: number) => `Backup restored: ${words(n)}.`,
    madeOn: (d: Date) => `Made on ${longDate(d, locale)}. `,
    backupHas: (n: number, days: number) => (
      <>
        It has {b(words(n))} and {plural(days, "day", "days")} of history, plus its settings.
      </>
    ),
    replaces: (n: number) => `It replaces what’s in this browser now (${words(n)}).`,
    noProgressHere: "This browser has no progress yet.",
    broken: (n: number) => `${N(n)} broken ${n === 1 ? "entry" : "entries"} in the file will be skipped.`,
  },

  reset: {
    title: "Start over from zero?",
    keep: "Keep my progress",
    delete: "Delete everything",
    body: (n: number) =>
      `This deletes your progress on ${words(n)} in this browser: reviews, your “Don’t know” list and daily history. Your settings stay. This can’t be undone.`,
  },

  feedback: {
    legend: "What is it about?",
    kinds: { bug: "Bug", idea: "Suggestion", word: "Wrong word info", other: "Other" },
    bugLabel: "What happened? What did you expect?",
    wordLabel: "Which word, and what’s wrong?",
    messageLabel: "Your message",
    thanks: "Thanks! Sent",
    replyByEmail: "You’ll get an answer by email.",
    everyRead: "Every message is read.",
    email: "Your email",
    optional: "(optional)",
    emailPlaceholder: "Only if you’d like an answer",
    byEmail: "Send by email instead",
    detailsNote: "The app version and your device type are added, to help fix problems.",
    sending: "Sending…",
    tryAgain: "Try again",
    send: "Send",
    // errors
    offline: "You’re offline.",
    noServer: `Couldn’t reach ${site.name}’s server.`,
    cantSend: "Couldn’t send it right now.",
    tooLong: "This message is too long.",
    checkForm: "Please check the form and try again.",
    notSetUp: "Feedback isn’t set up on the server yet.",
    tooMany: "That’s a lot of messages! Please wait a bit.",
  },

  report: {
    title: "Report a problem",
    with: (word: ReactNode) => <>with {word}</>,
    legend: "What’s wrong?",
    topics: { zh: "Chinese", es: "Spanish", example: "Example sentence", other: "Something else" },
    betterTranslation: "Better translation (optional)",
    whatShouldSay: "What should it say? (optional)",
    public: "Prefer it public?",
    issue: "Open a GitHub issue",
  },

  update: {
    ready: `A new version of ${site.name} is ready.`,
    offline: `${site.name} now works offline.`,
    later: "Later",
    update: "Update",
  },

  install: {
    share: "Share",
    menu: "menu",
    steps: (i: InstallIcons): Record<"ios" | "android" | "mac", ReactNode[]> => ({
      ios: [
        <>Tap {b("Share")} {i.share} in Safari’s toolbar (at the bottom on iPhone, at the top on iPad).</>,
        <>Scroll down and tap {b("Add to Home Screen")} {i.add}.</>,
        <>Tap {b("Add")}. {site.name} is now on your home screen.</>,
      ],
      android: [
        <>Open your browser’s {b("menu")} {i.menu} (top right in Chrome, bottom right in Firefox).</>,
        <>Tap {b("Install app")} or {b("Add to Home screen")}.</>,
        <>Confirm. {site.name} is now with your other apps.</>,
      ],
      mac: [<>In Safari’s menu bar, open {b("File")}.</>, <>Choose {b("Add to Dock…")}</>, <>Click {b("Add")}. {site.name} is now in your Dock and Launchpad.</>],
    }),
    notes: {
      ios: "Not in Safari? Chrome and Edge on iPhone have the same Share button. If you don’t see it, open this page in Safari.",
      android: "No such option? Open this page in Chrome.",
      mac: "Needs macOS 14 Sonoma or later. On older Macs, use Chrome or Edge.",
    },
    sheetTitle: (dock: boolean) => `Add ${site.name} to your ${dock ? "Dock" : "home screen"}`,
    gotIt: "Got it",
    getApp: "Get the app.",
    worksOffline: " It works offline too.",
    hide: "Hide",
    installed: "Installed",
    installTheApp: "Install the app",
    row: {
      installed: "You’re using the installed app.",
      done: `Installed. Open ${site.name} from your home screen or desktop.`,
      later: "Use the install icon in the address bar, or Install in the browser menu.",
      prompt: "Open it from your home screen or desktop like any other app.",
      ios: "Put it on your home screen and open it like any other app.",
      android: "Put it on your home screen and open it like any other app.",
      mac: "Put it in your Dock and open it like any other app.",
      none: "This browser can’t install apps. Chrome or Edge can (phones and computers), and Safari on iPhone, iPad and Mac.",
    },
  },

  move: {
    tooOld: "This browser is too old for this. Use “Download backup” below instead.",
    showQr: "Show QR code",
    enterCode: "Enter a code",
    nothingToSend: "Nothing to send yet. On the device you want to copy from, tap “Show QR code”.",
    whatMoves: "Your words, history and settings. They replace what’s on the other device.",
    making: "Making a code…",
    expired: "This code has expired.",
    scan: "Scan this with the other device’s camera.",
    qrLabel: (code: string) => `QR code with the link to ${site.name} and the code ${code}`,
    orType: `Or open ${site.name} there, go to Settings → Enter a code:`,
    codeAria: (spaced: string) => `Code ${spaced}`,
    worksFor: (time: string) => `Works for ${time} more. Until then your progress waits on ${site.name}’s server, then it’s deleted.`,
    iphoneNote: `On an iPhone or iPad with ${site.name} on the Home Screen, enter the code in that app: the camera opens Safari, which keeps its own copy.`,
    makeNew: "Make a new code",
    getTitle: "Get your progress",
    getIntro: "On the other device: Settings → Show QR code. Type the code shown under it.",
    code: "Code",
    getting: "Getting it…",
    getMine: "Get my progress",
    // errors
    badCode: "A code has 8 letters and numbers, like K7M2-QX9D.",
    offline: "You’re offline. Connect to the internet and try again.",
    noServer: `Couldn’t reach ${site.name}’s server. Try again in a moment.`,
    wrongCode: "This code is wrong or has expired (codes work for 10 minutes). Make a new one on the other device.",
    broken: "The progress didn’t arrive in one piece. Make a new code and try again.",
    tooBig: "This backup is too big to send.",
    notSetUp: "Moving to another device isn’t set up on the server yet.",
  },

  reminder: {
    label: "Remind me to study",
    iosFirst: `On iPhone and iPad, install ${site.name} first (Share → Add to Home Screen), then turn this on in the app.`,
    unsupported: "This browser can’t show reminders. Try Chrome, Edge, Firefox or Safari.",
    on: (time: string) => `Every day at ${time}, unless you’ve already studied.`,
    off: "A nudge at the time you choose, only on days you haven’t studied yet.",
    time: "Time",
    blocked: `Notifications are blocked for ${site.name}. Allow them in your browser’s or phone’s settings.`,
    privacy: `To send it, ${site.name}’s server keeps this device’s notification address, the time, your time zone and the last day you studied. Nothing else. Turning it off deletes them.`,
    // errors
    noWorker: "Reminders need the app’s offline support, which isn’t running here. Reload the page and try again.",
    noServer: "Couldn’t reach the server. Check your connection and try again.",
    switchedOff: "This device’s reminder was switched off. Turn it on again.",
    blockedRetry: `Notifications are blocked for ${site.name}. Allow them in your browser’s or phone’s settings, then try again.`,
    allow: `Tap “Allow” when your browser asks, so ${site.name} can remind you.`,
    notSetUp: "Reminders aren’t set up on the server yet.",
  },

  offline: {
    cantSave: "This browser can’t save the app for offline use.",
    checking: "Checking what’s saved…",
    checkFailed: "Couldn’t check the saved pronunciations. Are you online?",
    stopped: "Stopped. Tap again to continue where you left off.",
    failed: (n: number) => `${N(n)} couldn’t be saved (connection lost?). Tap again to retry.`,
    title: "Pronunciations",
    savedAria: "Pronunciations saved on this device",
    stop: "Stop",
    save: (rest: boolean, mb: number) => `Save ${rest ? "the rest" : "all"} for offline · about ${mb} MB`,
    allSaved: "All saved. Every word plays without internet.",
    note: "Words you’ve already heard are saved automatically. Without a saved file, your device’s own voice reads the word.",
  },

  backup: {
    notJson: "This file isn’t a backup (it isn’t JSON).",
    newer: "This backup was made by a newer version of the app. Reload the page and try again.",
    notOurs: `This file isn’t a ${site.name} backup.`,
  },
};

export type Messages = typeof en;
export default en;
