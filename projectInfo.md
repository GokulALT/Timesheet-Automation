# Project Overview
You are an expert full-stack developer. I need you to build an "AI-Powered Task Scheduler" web application. The application takes a start date, a number of working days, and a list of tasks, and uses a local AI (Ollama) to logically distribute those tasks across valid working dates.

# Tech Stack
* **Backend:** Node.js with Express.js
* **Frontend:** React (via Vite) with Tailwind CSS for styling
* **AI Integration:** `ollama` npm package (connecting to a local Ollama instance)

---

# Phase 1: Backend Setup (Node.js + Express)
Please create a complete Express backend with the following requirements:

1.  **Project Initialization:** Provide the `package.json` dependencies required (express, cors, ollama, dotenv).
2.  **Server Setup (`server.js`):** Set up an Express server running on port 3000 with CORS enabled and JSON body parsing.
3.  **API Endpoint (`POST /api/schedule`):** * Accepts a JSON payload: `{ startDate: "YYYY-MM-DD", daysRequired: number, tasks: string[] }`.
4.  **Deterministic Date Logic (CRITICAL):**
    * Write a helper function to calculate the valid working dates.
    * It must start from the `startDate` and find the exact number of `daysRequired`.
    * **Exclusion Rules:** It MUST skip every Sunday. It MUST skip the 2nd and 4th Saturday of the month.
    * Return these valid dates as an array of strings (YYYY-MM-DD).
5.  **AI Integration Service:**
    * Pass the calculated valid dates array and the user's tasks to Ollama.
    * Use this exact prompt structure for the LLM: 
        "You are a project manager. Distribute these tasks: [TASKS] logically across these specific dates: [DATES]. Group related tasks. Respond strictly in JSON format: [{ 'date': 'YYYY-MM-DD', 'tasks': ['task1', 'task2'] }]"
    * Parse the JSON response and return it to the client via the API.

---

# Phase 2: Frontend Setup (React + Tailwind)
Please create a clean, modern, single-page UI with the following requirements:

1.  **Layout:** A centered, responsive card layout with a clean header.
2.  **Input Form Component:**
    * `Start Date`: HTML date picker.
    * `Number of Days`: Number input (min 1).
    * `Tasks`: A textarea where users can paste their tasks (one per line).
    * `Submit Button`: A button that says "Generate Schedule". It should be disabled and show a loading spinner/state while waiting for the backend API.
3.  **Results Component:**
    * Once the API returns the JSON schedule, display it beautifully.
    * Render a list or grid of "Day Cards." 
    * Each card should show the Date as the header, and a bulleted list of tasks assigned to that day below it.
4.  **State Management:** Use standard React `useState` to handle form inputs, loading states, error handling (if the backend or Ollama fails), and the final schedule data.

---

# Implementation Instructions
Please provide the code in a step-by-step manner:
1.  First, provide the backend code (`server.js` and `scheduler logic`).
2.  Second, provide the frontend code (`App.jsx` and the main UI components).
3.  Include clear instructions on how to run both the frontend and backend servers simultaneously.

# site data
https://timesheet.lntedutech.com/en/timesheet/.

Context & DOM Elements:

The dashboard contains a button with the exact text + Create. Clicking this opens the timesheet entry form.

The resulting form will likely require inputs for Date, Begin Time, End Time, and a dropdown or input for Department.

The timesheet data table has columns for DATE, BEGIN, END, DURATION, and DEPARTMENT.

Requirements for the script:

Authentication Placeholder: Include a setup step or comment block where login credentials/session state would be handled before reaching the timesheet dashboard.

Navigation: Navigate to the URL and wait for the dashboard to load completely.

Click Create: Locate the + Create button (using a text or role locator) and click it. Wait for the entry modal or page to become visible.

Fill the Form: Create placeholder variables for the data (e.g., Date: '12/26/25', Begin: '09:00', End: '18:00', Department: 'Platform Engineering Department'). Write the actions to fill these into standard input/select fields.

Submit: Click the 'Save' or 'Submit' button (assume standard naming for the submission button).

Assertion: Add an assertion to verify the entry was created successfully by checking that the newly added Date and Begin/End times are now visible within the main timesheet data table.

Best Practices: Use Playwright's built-in web-first assertions, utilize Page Object Model (POM) structure if possible, and ensure the code handles dynamic waits gracefully rather than using hard timeouts."