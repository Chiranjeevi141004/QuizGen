import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, onSnapshot, query, updateDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';

// --- Placeholder Comments for Project Analysis ---
// <!-- Chosen Palette: Scholarly Neutrals -->
// <!-- Application Structure Plan: The application is a multi-page SPA simulated using a state variable (`page`). The user flow is task-oriented and linear (Host: Home -> Create -> Lobby -> Quiz -> Results; Player: Home -> Join -> Lobby -> Quiz -> Results). This structure was chosen because it directly maps to the user's goals, minimizes cognitive load, and is ideal for a single-file application, avoiding complex routing libraries while keeping logic centralized. Key interactions are form submissions, real-time updates via Firestore listeners, and state changes that trigger view transitions. -->
// <!-- Visualization & Content Choices: 
//   - Report Info: User Flow -> Goal: Guide user -> Viz/Presentation: Conditional Component Rendering -> Interaction: State change -> Justification: Creates a clear, step-by-step process. -> Library/Method: React state.
//   - Report Info: Lobby Players -> Goal: Inform -> Viz/Presentation: Dynamic List -> Interaction: Real-time updates -> Justification: Provides social context. -> Library/Method: HTML list from Firestore data.
//   - Report Info: Quiz Progress -> Goal: Show progress -> Viz/Presentation: Progress Bar -> Interaction: Updates on answer -> Justification: Manages user expectations. -> Library/Method: HTML div with dynamic width.
//   - Report Info: Results Scoreboard -> Goal: Compare -> Viz/Presentation: Sortable Table -> Interaction: Real-time population -> Justification: Clear overview for host. -> Library/Method: HTML table from Firestore data.
//   - Report Info: Result Explanations -> Goal: Educate -> Viz/Presentation: Detailed Answer Breakdown -> Interaction: Review -> Justification: Reinforces learning. -> Library/Method: HTML list mapping. -->
// <!-- CONFIRMATION: NO SVG graphics used. NO Mermaid JS used. -->

// --- Firebase Configuration ---
// This configuration is a placeholder. In a real environment, these values would be provided.
const firebaseConfig = typeof __firebase_config !== 'undefined'
    ? JSON.parse(__firebase_config)
    : {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_AUTH_DOMAIN",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_STORAGE_BUCKET",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
      };

// --- Helper Functions ---
const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
};

// --- Icon Components (using Unicode/HTML for simplicity) ---
const IconBookOpen = () => <span className="text-xl">📚</span>;
const IconUsers = () => <span className="text-xl">👥</span>;
const IconClipboardEdit = () => <span className="text-xl">📝</span>;
const IconLogIn = () => <span className="text-xl">🚪</span>;
const IconClock = () => <span className="text-xl">⏱️</span>;
const IconAward = () => <span className="text-xl">🏆</span>;
const IconBarChart = () => <span className="text-xl">📊</span>;
const IconCopy = () => <span className="text-xl">📋</span>;
const IconCheckCircle = () => <span className="text-green-500 text-xl">✔️</span>;
const IconXCircle = () => <span className="text-red-500 text-xl">❌</span>;
const IconChevronRight = () => <span className="text-xl">▶️</span>;
const IconSparkles = () => <span className="text-xl">✨</span>;
const IconLoader = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white inline-block"></div>
);
const IconLoaderDark = () => (
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
);

// --- Main App Component ---
export default function App() {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    // --- State Management ---
    const [page, setPage] = useState('home');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    
    // User & Room State
    const [userId, setUserId] = useState(null);
    const [userName, setUserName] = useState('');
    const [isHost, setIsHost] = useState(false);
    const [roomCode, setRoomCode] = useState('');
    const [quizData, setQuizData] = useState(null);

    // Quiz State
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [userAnswers, setUserAnswers] = useState([]);
    const [quizFinished, setQuizFinished] = useState(false);

    // Firebase instances
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);

    // --- Firebase Initialization ---
    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);
            setDb(firestoreDb);
            setAuth(firebaseAuth);

            onAuthStateChanged(firebaseAuth, (user) => {
                if (user) {
                    setUserId(user.uid);
                    setIsLoading(false);
                } else {
                    // If no user, attempt to sign in.
                    (async () => {
                        try {
                            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                                await signInWithCustomToken(firebaseAuth, __initial_auth_token);
                            } else {
                                await signInAnonymously(firebaseAuth);
                            }
                        } catch (err) {
                             console.error("Authentication failed:", err);
                             setError("Could not connect to the service.");
                             setIsLoading(false);
                        }
                    })();
                }
            });
        } catch (e) {
            console.error("Firebase init failed:", e);
            setError("Could not initialize the application. Please check your Firebase configuration.");
            setIsLoading(false);
        }
    }, []);

    // --- Real-time Room Listener ---
    useEffect(() => {
        if (!db || !roomCode) return;

        const roomDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'quizRooms', roomCode);
        const unsubscribe = onSnapshot(roomDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setQuizData(data);
                if (data.status === 'in-progress' && page !== 'quiz') {
                    setQuizFinished(false);
                    setCurrentQuestionIndex(0);
                    setUserAnswers([]);
                    setPage('quiz');
                }
                if (data.status === 'finished' && !quizFinished) {
                    setQuizFinished(true);
                    setPage('results');
                }
            } else {
                setError('Quiz room not found.');
                setRoomCode('');
                setPage('home');
            }
        });

        return () => unsubscribe();
    }, [db, roomCode, page, quizFinished, appId]);

    // --- Gemini API Functions ---
    const callGeminiAPI = async (payload) => {
        const apiKey = ""; // Provided by the runtime environment
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.json();
                console.error("API Error Response:", errorBody);
                throw new Error(`API request failed with status ${response.status}`);
            }

            const result = await response.json();
            const candidate = result.candidates?.[0];

            if (candidate && candidate.content?.parts?.[0]?.text) {
                return candidate.content.parts[0].text;
            } else {
                console.error("Invalid API response structure:", result);
                throw new Error("Failed to get valid content from AI response.");
            }
        } catch (error) {
            console.error("Error calling Gemini API:", error);
            throw error;
        }
    };

    const generateAIQuestions = async ({ topic, difficulty, numQuestions }) => {
        const schema = {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    question: { type: "STRING" },
                    options: { type: "ARRAY", items: { type: "STRING" } },
                    correctAnswer: { type: "STRING" },
                    explanation: { type: "STRING" }
                },
                required: ["question", "options", "correctAnswer", "explanation"]
            }
        };
        
        const prompt = `Generate exactly ${numQuestions} multiple-choice questions for a quiz about "${topic}" with a difficulty level of "${difficulty}". Ensure each question has exactly 4 options. The 'correctAnswer' field must be one of the strings from the 'options' array. Provide a brief, clear explanation for the correct answer.`;

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", responseSchema: schema },
        };

        try {
            const jsonResponse = await callGeminiAPI(payload);
            const parsedJson = JSON.parse(jsonResponse);
            if (Array.isArray(parsedJson) && parsedJson.length > 0) {
                return parsedJson;
            }
            throw new Error("Parsed JSON is not a valid question array.");
        } catch (e) {
            console.error("Failed to parse or get valid JSON from AI:", e);
            throw new Error("The AI failed to generate questions in the correct format. Please try a different topic or try again.");
        }
    };

    // --- Core Logic Functions ---
    const handleCreateQuiz = async (settings) => {
        setError('');
        try {
            const newRoomCode = generateRoomCode();
            const generatedQuestions = await generateAIQuestions(settings);
            const newQuizRoom = {
                topic: settings.topic,
                difficulty: settings.difficulty,
                timer: Number(settings.timer),
                status: 'lobby',
                hostId: userId,
                createdAt: new Date(),
                questions: generatedQuestions,
                players: {
                    [userId]: { id: userId, name: settings.hostName, score: 0, answers: [] }
                }
            };
            const roomDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'quizRooms', newRoomCode);
            await setDoc(roomDocRef, newQuizRoom);
            setRoomCode(newRoomCode);
            setUserName(settings.hostName);
            setIsHost(true);
            setPage('lobby');
        } catch (err) {
            console.error(err);
            setError(err.message || 'Failed to create quiz room. Please try again.');
            throw err; // Re-throw to be handled by the UI component
        }
    };

    const handleJoinQuiz = async (data) => {
        setIsLoading(true);
        setError('');
        try {
            const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'quizRooms', data.roomCode);
            const roomSnap = await getDoc(roomRef);

            if (roomSnap.exists()) {
                const roomData = roomSnap.data();
                if (roomData.status !== 'lobby') {
                    throw new Error('This quiz is already in progress or has finished.');
                }
                const newPlayer = { id: userId, name: data.playerName, score: 0, answers: [] };
                await updateDoc(roomRef, { [`players.${userId}`]: newPlayer });
                setRoomCode(data.roomCode);
                setUserName(data.playerName);
                setIsHost(false);
                setPage('lobby');
            } else {
                throw new Error('Room not found. Please check the code.');
            }
        } catch (err) {
            console.error(err);
            setError(err.message || 'Failed to join room.');
        }
        setIsLoading(false);
    };

    const handleStartQuiz = async () => {
        setIsLoading(true);
        try {
            const roomDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'quizRooms', roomCode);
            await updateDoc(roomDocRef, { status: 'in-progress' });
        } catch (err) {
            console.error(err);
            setError('Could not start the quiz.');
        }
        setIsLoading(false);
    };
    
    const handleAnswerSubmit = async (answer) => {
        if (!quizData) return;

        const currentQuestion = quizData.questions[currentQuestionIndex];
        const isCorrect = answer === currentQuestion.correctAnswer;
        const scoreIncrement = isCorrect ? 10 : 0;
        const newAnswer = { questionIndex: currentQuestionIndex, answer: answer, isCorrect: isCorrect };

        const updatedAnswers = [...userAnswers, newAnswer];
        setUserAnswers(updatedAnswers);

        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'quizRooms', roomCode);
        const currentScore = quizData.players[userId]?.score || 0;
        await updateDoc(roomRef, {
            [`players.${userId}.answers`]: updatedAnswers,
            [`players.${userId}.score`]: currentScore + scoreIncrement
        });

        if (currentQuestionIndex < quizData.questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedAnswer(null);
        } else {
            await updateDoc(roomRef, { status: 'finished' });
            setQuizFinished(true);
            setPage('results');
        }
    };

    const handleReturnHome = () => {
        setPage('home');
        setRoomCode('');
        setQuizData(null);
        setIsHost(false);
        setError('');
        setQuizFinished(false);
    };

    // --- Render Logic ---
    const renderPage = () => {
        if (isLoading) return <LoadingPage />;
        
        switch (page) {
            case 'create':
                return <CreateQuizPage onCreate={handleCreateQuiz} userName={userName} setUserName={setUserName} />;
            case 'join':
                return <JoinQuizPage onJoin={handleJoinQuiz} />;
            case 'lobby':
                return <LobbyPage isHost={isHost} roomCode={roomCode} quizData={quizData} onStart={handleStartQuiz} />;
            case 'quiz':
                return <QuizPage quizData={quizData} currentQuestionIndex={currentQuestionIndex} onSubmit={handleAnswerSubmit} selectedAnswer={selectedAnswer} setSelectedAnswer={setSelectedAnswer} />;
            case 'results':
                return <ResultsPage quizData={quizData} userId={userId} onReturnHome={handleReturnHome} callGeminiAPI={callGeminiAPI} />;
            case 'home':
            default:
                return <HomePage onNavigate={setPage} />;
        }
    };

    return (
        <div className="bg-slate-50 min-h-screen font-sans text-slate-800 flex flex-col items-center justify-center p-4">
            <main className="w-full max-w-2xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold text-indigo-600 flex items-center justify-center gap-3">
                        <IconBookOpen /> AI Quiz Platform
                    </h1>
                    <p className="text-slate-500 mt-2">Powered by ChiruBrains.</p>
                </header>
                <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 border border-slate-200 transition-all duration-300">
                    {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert"><p>{error}</p></div>}
                    {renderPage()}
                </div>
                <footer className="text-center mt-8 text-sm text-slate-400">
                    <p>&copy; 2025 AI Quiz Platform. All rights reserved.</p>
                </footer>
            </main>
        </div>
    );
}

// --- Page Components ---

const LoadingPage = () => (
    <div className="flex flex-col items-center justify-center h-64">
        <IconLoaderDark />
        <p className="mt-4 text-slate-500">Loading...</p>
    </div>
);

const HomePage = ({ onNavigate }) => (
    <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Welcome!</h2>
        <p className="text-slate-600 mb-8">Choose your role to get started.</p>
        <div className="flex flex-col md:flex-row gap-4 justify-center">
            <button onClick={() => onNavigate('create')} className="flex-1 bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-transform transform hover:scale-105 flex items-center justify-center gap-2">
                <IconClipboardEdit /> Create Quiz
            </button>
            <button onClick={() => onNavigate('join')} className="flex-1 bg-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-purple-700 transition-transform transform hover:scale-105 flex items-center justify-center gap-2">
                <IconLogIn /> Join Quiz
            </button>
        </div>
    </div>
);

const CreateQuizPage = ({ onCreate, userName, setUserName }) => {
    const [settings, setSettings] = useState({ topic: 'JavaScript', difficulty: 'Medium', numQuestions: '5', timer: '30' });
    const [isGenerating, setIsGenerating] = useState(false);

    const handleChange = (e) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userName.trim() || !settings.topic.trim()) {
            alert('Please enter your name and a topic.');
            return;
        }
        setIsGenerating(true);
        try {
            await onCreate({ ...settings, hostName: userName });
        } catch (error) {
            setIsGenerating(false);
        }
    };

    return (
        <div>
            <h2 className="text-2xl font-semibold mb-6 text-center">Create a New Quiz</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="hostName" className="block text-sm font-medium text-slate-700">Your Name</label>
                    <input type="text" name="hostName" id="hostName" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Enter your name" className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" required />
                </div>
                <div>
                    <label htmlFor="topic" className="block text-sm font-medium text-slate-700">Topic</label>
                    <input type="text" name="topic" id="topic" value={settings.topic} onChange={handleChange} placeholder="e.g., World History, Python Basics" className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="difficulty" className="block text-sm font-medium text-slate-700">Difficulty</label>
                        <select name="difficulty" id="difficulty" value={settings.difficulty} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                            <option>Easy</option>
                            <option>Medium</option>
                            <option>Hard</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="numQuestions" className="block text-sm font-medium text-slate-700">Questions</label>
                        <select name="numQuestions" id="numQuestions" value={settings.numQuestions} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                            <option>3</option>
                            <option>5</option>
                            <option>10</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label htmlFor="timer" className="block text-sm font-medium text-slate-700">Timer per Question (seconds)</label>
                    <input type="number" name="timer" id="timer" value={settings.timer} onChange={handleChange} min="10" max="120" className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <button type="submit" disabled={isGenerating} className="w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-transform transform hover:scale-105 flex items-center justify-center gap-2 mt-4 disabled:bg-indigo-400 disabled:scale-100 disabled:cursor-wait">
                    {isGenerating ? <><IconLoader /> Generating with AI...</> : <><IconSparkles /> Generate Quiz & Create Room</>}
                </button>
            </form>
        </div>
    );
};

const JoinQuizPage = ({ onJoin }) => {
    const [data, setData] = useState({ roomCode: '', playerName: '' });

    const handleChange = (e) => {
        const value = e.target.name === 'roomCode' ? e.target.value.toUpperCase() : e.target.value;
        setData({ ...data, [e.target.name]: value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!data.roomCode.trim() || !data.playerName.trim()) {
            alert('Please fill in all fields.');
            return;
        }
        onJoin(data);
    };

    return (
        <div>
            <h2 className="text-2xl font-semibold mb-6 text-center">Join a Quiz Room</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="playerName" className="block text-sm font-medium text-slate-700">Your Name</label>
                    <input type="text" name="playerName" id="playerName" value={data.playerName} onChange={handleChange} placeholder="Enter your name" className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" required />
                </div>
                <div>
                    <label htmlFor="roomCode" className="block text-sm font-medium text-slate-700">Room Code</label>
                    <input type="text" name="roomCode" id="roomCode" value={data.roomCode} onChange={handleChange} placeholder="Enter 5-letter code" maxLength="5" className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 uppercase tracking-widest" required />
                </div>
                <button type="submit" className="w-full bg-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-purple-700 transition-transform transform hover:scale-105 flex items-center justify-center gap-2 mt-4">
                    Join Quiz
                </button>
            </form>
        </div>
    );
};

const LobbyPage = ({ isHost, roomCode, quizData, onStart }) => {
    const players = useMemo(() => quizData ? Object.values(quizData.players) : [], [quizData]);

    const handleCopyCode = () => {
        navigator.clipboard.writeText(roomCode)
            .then(() => alert('Room code copied to clipboard!'))
            .catch(err => console.error('Failed to copy text: ', err));
    };
    
    if (!quizData) return <LoadingPage />;

    return (
        <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">Quiz Lobby</h2>
            <p className="text-slate-500 mb-4">Topic: <span className="font-bold text-indigo-600">{quizData.topic}</span></p>
            <div className="bg-slate-100 p-3 rounded-lg flex items-center justify-center gap-4 mb-6">
                <p className="text-slate-700">Room Code:</p>
                <strong className="text-2xl tracking-widest text-purple-700">{roomCode}</strong>
                <button onClick={handleCopyCode} title="Copy Code" className="p-2 rounded-md hover:bg-slate-200 transition">
                    <IconCopy />
                </button>
            </div>

            <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center justify-center gap-2"><IconUsers /> Players Joined ({players.length})</h3>
                <div className="max-h-40 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                    {players.length > 0 ? players.map(p => (
                        <p key={p.id} className="text-slate-700 bg-white p-2 rounded-md shadow-sm">{p.name}</p>
                    )) : <p className="text-slate-400 italic">No players have joined yet.</p>}
                </div>
            </div>

            {isHost ? (
                <button onClick={onStart} disabled={players.length === 0} className="w-full bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 transition-transform transform hover:scale-105 disabled:bg-slate-400 disabled:cursor-not-allowed disabled:scale-100">
                    {players.length > 0 ? "Start Quiz for Everyone" : "Waiting for players..."}
                </button>
            ) : (
                <div className="flex flex-col items-center justify-center">
                    <IconLoaderDark />
                    <p className="mt-4 text-slate-500 animate-pulse">Waiting for the host to start the quiz...</p>
                </div>
            )}
        </div>
    );
};

const QuizPage = ({ quizData, currentQuestionIndex, onSubmit, selectedAnswer, setSelectedAnswer }) => {
    const [timeLeft, setTimeLeft] = useState(quizData?.timer || 30);
    const currentQuestion = quizData?.questions[currentQuestionIndex];
    
    const handleSubmit = useCallback(onSubmit, [onSubmit]);

    useEffect(() => {
        if (!quizData || !currentQuestion) return;
        
        setTimeLeft(quizData.timer);
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleSubmit('No Answer'); 
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [currentQuestionIndex, quizData, currentQuestion, handleSubmit]);

    const handleButtonClick = (answer) => {
        if (answer !== null) {
            handleSubmit(answer);
        }
    };

    if (!currentQuestion) return <p>Loading question...</p>;

    const progressPercentage = ((currentQuestionIndex + 1) / quizData.questions.length) * 100;
    const timerPercentage = (timeLeft / quizData.timer) * 100;

    return (
        <div>
            <div className="mb-4">
                <div className="flex justify-between items-center text-sm text-slate-500 mb-1">
                    <span>Question {currentQuestionIndex + 1} of {quizData.questions.length}</span>
                    <span className="flex items-center gap-1"><IconClock /> {timeLeft}s</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5">
                    <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${progressPercentage}%` }}></div>
                </div>
                 <div className="w-full bg-slate-200 rounded-full h-1 mt-2">
                    <div className="bg-purple-500 h-1 rounded-full transition-all duration-1000 linear" style={{ width: `${timerPercentage}%` }}></div>
                </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
                <h3 className="text-xl font-semibold text-center">{currentQuestion.question}</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQuestion.options.map((option, index) => (
                    <button 
                        key={index} 
                        onClick={() => setSelectedAnswer(option)}
                        className={`p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                            selectedAnswer === option 
                            ? 'bg-indigo-100 border-indigo-500 ring-2 ring-indigo-300' 
                            : 'bg-white border-slate-300 hover:bg-slate-100 hover:border-slate-400'
                        }`}
                    >
                        {option}
                    </button>
                ))}
            </div>

            <button
                onClick={() => handleButtonClick(selectedAnswer)}
                disabled={selectedAnswer === null}
                className="w-full mt-8 bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-transform transform hover:scale-105 disabled:bg-slate-400 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center gap-2"
            >
                Submit Answer <IconChevronRight />
            </button>
        </div>
    );
};

const ResultsPage = ({ quizData, userId, onReturnHome, callGeminiAPI }) => {
    const user = quizData?.players[userId];
    const players = useMemo(() => quizData ? Object.values(quizData.players).sort((a, b) => b.score - a.score) : [], [quizData]);
    const [aiSummary, setAiSummary] = useState('');
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    
    if (!quizData || !user) return <LoadingPage />;

    const getAIPerformanceSummary = async () => {
        setIsSummaryLoading(true);
        setAiSummary('');
        const isHost = quizData.hostId === userId;
        let prompt = '';

        if (isHost) {
            const allPlayersData = Object.values(quizData.players).map(p => ({ name: p.name, score: p.score, answers: p.answers }));
            prompt = `You are an insightful teaching assistant. A teacher has just hosted a quiz on "${quizData.topic}". Here are the results for all players in JSON: ${JSON.stringify(allPlayersData)}. Analyze the overall performance. First, provide a one-paragraph summary of how the class performed as a whole. Then, identify the question(s) that most students struggled with and explain the potential common misconception for each difficult question. Finally, suggest what the teacher might want to review with the class. Format your response clearly using Markdown (bolding, lists).`;
        } else {
            const userPerformance = {
                questions: quizData.questions.map(q => ({ question: q.question })),
                answers: user.answers
            };
            prompt = `You are a friendly and encouraging learning coach. A student has just completed a quiz on "${quizData.topic}". Here are the questions and the student's answers: ${JSON.stringify(userPerformance)}. Provide a concise, encouraging summary of their performance in one paragraph. Then, create a "Strengths" section highlighting topics they did well on. In an "Areas for Review" section, gently point out concepts they struggled with and suggest specific things to study based on their incorrect answers. Keep the tone positive and helpful. Format your response clearly using Markdown (bolding, lists).`;
        }

        try {
            const payload = { contents: [{ parts: [{ text: prompt }] }] };
            const summary = await callGeminiAPI(payload);
            setAiSummary(summary);
        } catch (error) {
            setAiSummary("Sorry, I couldn't generate a summary at this time. Please try again later.");
        } finally {
            setIsSummaryLoading(false);
        }
    };
    
    const userScore = user.score;
    const totalQuestions = quizData.questions.length;
    const correctAnswers = user.answers.filter(a => a.isCorrect).length;

    return (
        <div>
            <h2 className="text-3xl font-bold mb-4 text-center text-purple-700 flex items-center justify-center gap-3"><IconAward /> Quiz Complete!</h2>
            
            <div className="bg-indigo-50 p-6 rounded-xl text-center mb-6 border border-indigo-200">
                <p className="text-lg text-slate-700">Your Score:</p>
                <p className="text-6xl font-bold text-indigo-600 my-2">{userScore}</p>
                <p className="text-md text-slate-500">You answered {correctAnswers} out of {totalQuestions} questions correctly.</p>
            </div>

            <div className="my-6 text-center">
                <button onClick={getAIPerformanceSummary} disabled={isSummaryLoading} className="bg-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-purple-700 transition-transform transform hover:scale-105 flex items-center justify-center gap-2 mx-auto disabled:bg-purple-400 disabled:scale-100 disabled:cursor-wait">
                    {isSummaryLoading ? <><IconLoader /> Analyzing Performance...</> : <><IconSparkles /> Get AI Performance Summary</>}
                </button>
            </div>
            {aiSummary && (
                <div className="p-4 bg-slate-50 border rounded-lg my-6 prose prose-slate max-w-none">
                    <h3 className="text-lg font-semibold mb-2 text-indigo-600 flex items-center gap-2"><IconSparkles /> AI Summary</h3>
                    <div className="text-slate-700 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: aiSummary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />') }}></div>
                </div>
            )}
            
            {quizData.hostId === userId && (
                 <div className="mb-8">
                    <h3 className="text-xl font-semibold mb-3 text-center flex items-center justify-center gap-2"><IconBarChart /> Leaderboard</h3>
                    <div className="bg-slate-50 border rounded-lg p-3 max-h-60 overflow-y-auto">
                        <table className="w-full text-left">
                            <thead><tr className="border-b"><th className="p-2">Rank</th><th className="p-2">Name</th><th className="p-2">Score</th></tr></thead>
                            <tbody>
                                {players.map((p, index) => (
                                    <tr key={p.id} className={`border-b last:border-b-0 ${p.id === userId ? 'bg-indigo-100' : ''}`}>
                                        <td className="p-2 font-bold">{index + 1}</td>
                                        <td className="p-2">{p.name} {p.id === userId && '(You)'}</td>
                                        <td className="p-2">{p.score}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
           
            <div className="mb-6">
                <h3 className="text-xl font-semibold mb-3 text-center">Answer Breakdown</h3>
                <div className="space-y-4">
                    {quizData.questions.map((q, index) => {
                        const userAnswer = user.answers.find(a => a.questionIndex === index);
                        return (
                            <div key={index} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <p className="font-semibold mb-2">{index + 1}. {q.question}</p>
                                <p className={`flex items-center gap-2 p-2 rounded-md ${userAnswer?.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
                                    {userAnswer?.isCorrect ? <IconCheckCircle /> : <IconXCircle />}
                                    Your answer: <span className="font-bold">{userAnswer?.answer || 'No Answer'}</span>
                                </p>
                                {!userAnswer?.isCorrect && (
                                     <p className="flex items-center gap-2 p-2 rounded-md mt-2 bg-green-50 border border-green-200">
                                         <IconCheckCircle /> Correct answer: <span className="font-bold">{q.correctAnswer}</span>
                                     </p>
                                )}
                                <p className="text-sm text-slate-600 mt-2 p-2 bg-slate-100 rounded-md">{q.explanation}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            <button onClick={onReturnHome} className="w-full bg-slate-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-700 transition-transform transform hover:scale-105">
                Return to Home
            </button>
        </div>
    );
};

