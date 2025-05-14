const minutesDisplay = document.getElementById('minutes');
const secondsDisplay = document.getElementById('seconds');
const startButton = document.getElementById('start');
const pauseButton = document.getElementById('pause');
const resetButton = document.getElementById('reset');
const taskNameInput = document.getElementById('task-name');
const pomodoroCountDisplay = document.getElementById('pomodoro-count');
const currentCycleDisplay = document.getElementById('current-cycle');
const timerDiv = document.querySelector('.timer'); // Get the div.timer element

// Duration display/edit elements
const durationLabels = document.querySelectorAll('.duration-label'); // Target the parent label spans
const dispWorkDuration = document.getElementById('disp-work-duration');
const dispShortBreakDuration = document.getElementById('disp-short-break-duration');
const dispLongBreakDuration = document.getElementById('disp-long-break-duration');

// Task Management Elements
const activeTaskNameDisplay = document.getElementById('active-task-name');

let vantaEffect = null; // Variable to store the Vanta.js instance
let timerInterval;
let timeLeft;
let isPaused = true;
let pomodorosCompleted = 0;
let currentMode = 'work';
let activeTask = ''; // Variable to store the current active task

let WORK_DURATION_SEC = 25 * 60;
let SHORT_BREAK_DURATION_SEC = 5 * 60;
let LONG_BREAK_DURATION_SEC = 15 * 60;
const POMODOROS_BEFORE_LONG_BREAK = 4;

// New: Reference to the main heading for notifications
const mainHeading = document.querySelector('.container h1');
let originalHeadingText = mainHeading.textContent;

// Audio notification sound
const notificationSound = new Audio('notification.mp3'); // Assurez-vous d'avoir un fichier notification.mp3

// --- Vanta.js Color Update Function ---
function updateVantaColors(mode) {
    if (!vantaEffect) return;

    let newHighlightColor = 0x1a3b20; // Default to work (dark desaturated green)
    let newMidtoneColor = 0x2a5230;
    let newLowlightColor = 0x0f2013;

    if (mode === 'shortBreak') {
        newHighlightColor = 0x1a2c3b; // Dark desaturated blue
        newMidtoneColor = 0x2a4052;
        newLowlightColor = 0x0f1a20;
    } else if (mode === 'longBreak') {
        newHighlightColor = 0x3b2e1a; // Dark desaturated orange/amber
        newMidtoneColor = 0x52422a;
        newLowlightColor = 0x201b0f;
    }

    vantaEffect.setOptions({
        highlightColor: newHighlightColor,
        midtoneColor: newMidtoneColor,
        lowlightColor: newLowlightColor,
        baseColor: 0x000000 // Keep base color black
    });
}

// --- LocalStorage & Settings Functions ---
function saveDurations() {
    localStorage.setItem('pomodoroApp_workDurationMin', (WORK_DURATION_SEC / 60).toString());
    localStorage.setItem('pomodoroApp_shortBreakDurationMin', (SHORT_BREAK_DURATION_SEC / 60).toString());
    localStorage.setItem('pomodoroApp_longBreakDurationMin', (LONG_BREAK_DURATION_SEC / 60).toString());
}

function savePomodoroCount() {
    localStorage.setItem('pomodoroApp_pomodorosCompleted', pomodorosCompleted.toString());
}

function saveActiveTask() {
    localStorage.setItem('pomodoroApp_activeTask', activeTask);
}

function animateActiveTaskDisplay() {
    if (activeTaskNameDisplay.textContent) { 
        activeTaskNameDisplay.classList.remove('task-appear');
        // Force reflow/repaint to ensure animation restarts if class is re-added quickly
        void activeTaskNameDisplay.offsetWidth;
        activeTaskNameDisplay.classList.add('task-appear');
    }
}

function loadSettings() {
    const savedWorkMin = localStorage.getItem('pomodoroApp_workDurationMin');
    const savedShortBreakMin = localStorage.getItem('pomodoroApp_shortBreakDurationMin');
    const savedLongBreakMin = localStorage.getItem('pomodoroApp_longBreakDurationMin');
    const savedPomodoros = localStorage.getItem('pomodoroApp_pomodorosCompleted');

    WORK_DURATION_SEC = savedWorkMin ? parseInt(savedWorkMin, 10) * 60 : 25 * 60;
    SHORT_BREAK_DURATION_SEC = savedShortBreakMin ? parseInt(savedShortBreakMin, 10) * 60 : 5 * 60;
    LONG_BREAK_DURATION_SEC = savedLongBreakMin ? parseInt(savedLongBreakMin, 10) * 60 : 15 * 60;

    dispWorkDuration.textContent = WORK_DURATION_SEC / 60;
    dispShortBreakDuration.textContent = SHORT_BREAK_DURATION_SEC / 60;
    dispLongBreakDuration.textContent = LONG_BREAK_DURATION_SEC / 60;

    if (savedPomodoros) {
        pomodorosCompleted = parseInt(savedPomodoros, 10);
        pomodoroCountDisplay.textContent = pomodorosCompleted;
    }

    const savedActiveTask = localStorage.getItem('pomodoroApp_activeTask');
    if (savedActiveTask) {
        activeTask = savedActiveTask;
        activeTaskNameDisplay.textContent = activeTask;
        animateActiveTaskDisplay(); // Animate loaded task name
        taskNameInput.placeholder = "Changer de tâche ? (Entrée)"; // Update placeholder if a task is active
    }
}

// --- Inline Duration Editing ---
function makeDurationEditable(labelElement) {
    const spanElement = labelElement.querySelector('.editable-duration');
    if (!spanElement) return; // Should not happen if HTML is correct

    if (isPaused && !spanElement.querySelector('input')) { 
        const currentText = spanElement.textContent.trim();
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.value = currentText;
        input.className = 'duration-input-active';
        
        spanElement.innerHTML = ''; 
        spanElement.appendChild(input);
        input.focus();
        input.select();

        function saveEdit(event) {
            const newValue = parseInt(input.value, 10);
            if (!isNaN(newValue) && newValue > 0) {
                spanElement.textContent = newValue;
                const durationType = spanElement.dataset.durationType;
                if (durationType === 'work') WORK_DURATION_SEC = newValue * 60;
                else if (durationType === 'shortBreak') SHORT_BREAK_DURATION_SEC = newValue * 60;
                else if (durationType === 'longBreak') LONG_BREAK_DURATION_SEC = newValue * 60;
                saveDurations();
                
                if (isPaused && 
                    ((currentMode === 'work' && durationType === 'work') || 
                     (currentMode === 'shortBreak' && durationType === 'shortBreak') || 
                     (currentMode === 'longBreak' && durationType === 'longBreak'))) {
                    timeLeft = newValue * 60;
                    updateTimerDisplay();
                }
            } else {
                spanElement.textContent = currentText; 
            }
            if (spanElement.contains(input)) {
                spanElement.removeChild(input);
            }
            input.removeEventListener('blur', saveEdit);
            input.removeEventListener('keydown', handleKeydown);
        }

        function handleKeydown(e) {
            if (e.key === 'Enter') {
                saveEdit(); 
            } else if (e.key === 'Escape') {
                spanElement.textContent = currentText;
                if (spanElement.contains(input)) {
                    spanElement.removeChild(input);
                }
                input.removeEventListener('blur', saveEdit);
                input.removeEventListener('keydown', handleKeydown);
            }
        }

        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', handleKeydown);
    }
}

// Attach listener to the parent .duration-label spans
durationLabels.forEach(label => {
    label.addEventListener('click', () => makeDurationEditable(label));
});

// --- Pomodoro Counter Animation ---
function triggerPomodoroCountAnimation() {
    pomodoroCountDisplay.classList.add('animate-counter');
    setTimeout(() => {
        pomodoroCountDisplay.classList.remove('animate-counter');
    }, 500); 
}

function requestNotificationPermission() {
    if ('Notification' in window) {
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('Notification permission granted.');
                } else {
                    console.log('Notification permission denied.');
                }
            });
        }
    }
}

function showNotification(message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Pomodoro App', {
            body: message,
            icon: 'pomodoro_icon.png' // Optionnel: ajoutez une icône
        });
        notificationSound.play().catch(error => console.log("Erreur de lecture du son: ", error));
    } else {
        // Fallback: change heading text if notifications are not available or denied
        mainHeading.textContent = message;
        // Consider also playing the sound here as a fallback if appropriate
        // notificationSound.play().catch(error => console.log("Erreur de lecture du son: ", error));
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    minutesDisplay.textContent = String(minutes).padStart(2, '0');
    secondsDisplay.textContent = String(seconds).padStart(2, '0');
    
    let titleTask = activeTask ? `${activeTask} - ` : '';
    if (!isPaused) { // Only add task to title if timer is running
        document.title = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} - ${titleTask}Pomodoro`;
    } else {
        document.title = `${titleTask}Pomodoro App`; // Show task in title even if paused, or just app name
    }
}

function updateBodyClass() {
    document.body.classList.remove('work-mode', 'short-break-mode', 'long-break-mode');
    const containerElement = document.querySelector('.container');
    
    // Always remove for re-trigger, then add it back in a timeout.
    containerElement.classList.remove('mode-transitioning');

    let cycleText = 'Travail';
    if (currentMode === 'work') {
        document.body.classList.add('work-mode');
        cycleText = 'Travail';
    } else if (currentMode === 'shortBreak') {
        document.body.classList.add('short-break-mode');
        cycleText = 'Courte Pause';
    } else if (currentMode === 'longBreak') {
        document.body.classList.add('long-break-mode');
        cycleText = 'Longue Pause';
    }
    currentCycleDisplay.textContent = cycleText;

    updateVantaColors(currentMode); 

    // Trigger sweep animation on container
    setTimeout(() => {
        if (containerElement) { // Ensure element exists
            containerElement.classList.add('mode-transitioning');
        }
    }, 10); // Small delay to ensure class change is detected for animation re-trigger
}

function startTimer() {
    requestNotificationPermission();
    if (isPaused) {
        isPaused = false;
        startButton.disabled = true;
        pauseButton.disabled = false;
        resetButton.disabled = false;
        mainHeading.textContent = originalHeadingText;
        timerDiv.classList.add('timer-active');

        if (timeLeft === undefined || timeLeft <= 0) { // Ensure timeLeft is set for the very first start or after an edit
            if (currentMode === 'work') timeLeft = WORK_DURATION_SEC;
            else if (currentMode === 'shortBreak') timeLeft = SHORT_BREAK_DURATION_SEC;
            else if (currentMode === 'longBreak') timeLeft = LONG_BREAK_DURATION_SEC;
            else timeLeft = WORK_DURATION_SEC; // Default fallback
            updateTimerDisplay();
        }

        timerInterval = setInterval(() => {
            if (timeLeft > 0) {
                timeLeft--;
                updateTimerDisplay();
            } else {
                clearInterval(timerInterval);
                timerDiv.classList.remove('timer-active');
                handleSessionEnd();
            }
        }, 1000);
    }
}

function pauseTimer() {
    isPaused = true;
    clearInterval(timerInterval);
    startButton.textContent = 'Reprendre';
    startButton.disabled = false;
    pauseButton.disabled = true;
    timerDiv.classList.remove('timer-active'); // Remove class when timer is paused
}

function resetTimer(durationInSeconds, modeToSet) {
    pauseTimer();
    currentMode = modeToSet;
    timeLeft = durationInSeconds;
    updateTimerDisplay();
    updateBodyClass();
    currentCycleDisplay.textContent = modeToSet === 'work' ? 'Travail' : (modeToSet === 'shortBreak' ? 'Courte Pause' : 'Longue Pause');
    
    if (modeToSet === 'work' && durationInSeconds === WORK_DURATION_SEC) {
        startButton.textContent = 'Démarrer';
    } else {
        startButton.textContent = currentMode === 'work' ? 'Démarrer Travail' : 'Démarrer Pause';
    }
    mainHeading.textContent = originalHeadingText;
}

function handleSessionEnd() {
    if(timerInterval) clearInterval(timerInterval);
    timerDiv.classList.remove('timer-active');
    let message = '';

    if (currentMode === 'work') {
        pomodorosCompleted++;
        pomodoroCountDisplay.textContent = pomodorosCompleted;
        triggerPomodoroCountAnimation();
        savePomodoroCount();

        message = 'Session de travail terminée ! Prêt pour une pause ?';
        if (pomodorosCompleted % POMODOROS_BEFORE_LONG_BREAK === 0) {
            resetTimer(LONG_BREAK_DURATION_SEC, 'longBreak');
        } else {
            resetTimer(SHORT_BREAK_DURATION_SEC, 'shortBreak');
        }
    } else { 
        message = currentMode === 'shortBreak' ? 'Courte pause terminée ! Retour au travail ?' : 'Longue pause terminée ! Prêt à continuer ?';
        resetTimer(WORK_DURATION_SEC, 'work');
    }
    showNotification(message);
    isPaused = true; 
    startButton.disabled = false;
    pauseButton.disabled = true;
}

// --- Task Management Functions ---
function handleTaskInput(event) {
    if (event.key === 'Enter') {
        const newTaskName = taskNameInput.value.trim();
        if (newTaskName) {
            activeTask = newTaskName;
            activeTaskNameDisplay.textContent = activeTask;
            animateActiveTaskDisplay(); // Animate new task name
            taskNameInput.value = ''; // Clear the input field
            taskNameInput.placeholder = "Changer de tâche ? (Entrée)";
            saveActiveTask();
            updateTimerDisplay(); // Update document title if timer is running
        } else { // If user presses Enter on empty input, and a task is active, allow clearing it
            if(activeTask){
                activeTask = '';
                activeTaskNameDisplay.textContent = '';
                taskNameInput.placeholder = "Nouvelle tâche ? (Entrée pour valider)";
                saveActiveTask();
                updateTimerDisplay(); 
            }
        }
    }
}

// Event Listeners
startButton.addEventListener('click', startTimer);
pauseButton.addEventListener('click', pauseTimer);
resetButton.addEventListener('click', () => {
    resetTimer(WORK_DURATION_SEC, 'work');
    pomodorosCompleted = 0; 
    pomodoroCountDisplay.textContent = pomodorosCompleted;
    triggerPomodoroCountAnimation();
    savePomodoroCount();
    mainHeading.textContent = originalHeadingText;
});

taskNameInput.addEventListener('keydown', handleTaskInput);

// Initial Setup on Load
loadSettings(); // Load saved settings (durations and pomodoro count)
timeLeft = WORK_DURATION_SEC; // Set initial timeLeft based on loaded/default work duration
updateTimerDisplay();
updateBodyClass();
pauseButton.disabled = true;

// VANTA.js Background Initialization
window.addEventListener('DOMContentLoaded', () => {
  if (window.VANTA) {
    vantaEffect = VANTA.FOG({ // Store the Vanta effect instance
      el: "body",
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200.00,
      minWidth: 200.00,
      // Initial colors will be set by updateVantaColors via updateBodyClass on load
      highlightColor: 0x1a3b20, 
      midtoneColor: 0x2a5230,   
      lowlightColor: 0x0f2013,  
      baseColor: 0x000000,     
      blurFactor: 0.60,
      speed: 0.50,
      zoom: 0.80
    });
    // Ensure currentMode is loaded before calling this if it's not already handled by the main script flow
    // updateBodyClass() called at the end of the script will handle initial Vanta colors too.
  }
}); 