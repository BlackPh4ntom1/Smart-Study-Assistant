import { useState, useEffect } from 'react';
import { Upload, BookOpen, Brain, BarChart3, Plus, Play, FileText, File, Trash2, CheckCircle, XCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import './App.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const generateStudyMaterials = async (text, types = ['flashcard', 'mcq', 'truefalse'], count = 15) => {
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const materials = [];
  const itemsPerType = Math.ceil(count / types.length);
  
  types.forEach(type => {
    for (let i = 0; i < Math.min(itemsPerType, sentences.length); i++) {
      const sentence = sentences[Math.floor(Math.random() * sentences.length)].trim();
      const words = sentence.split(' ');
      
      if (words.length > 5) {
        const keyword = words[Math.floor(words.length / 2)];
        
        let item = {
          id: Date.now() + Math.random(),
          type,
          difficulty: ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)],
          nextReview: new Date(),
          interval: 1,
          easeFactor: 2.5,
          repetitions: 0
        };
        
        if (type === 'flashcard') {
          item.question = `What is ${keyword} in the context of this topic?`;
          item.answer = sentence;
        } else if (type === 'mcq') {
          item.question = `Which statement about ${keyword} is correct?`;
          item.options = [sentence, `${keyword} is unrelated`, `Opposite meaning`, `Different concept`].sort(() => Math.random() - 0.5);
          item.correctAnswer = sentence;
        } else if (type === 'truefalse') {
          const isTrue = Math.random() > 0.5;
          item.question = isTrue ? sentence : sentence.replace(keyword, 'incorrect');
          item.correctAnswer = isTrue;
          item.explanation = isTrue ? `This is true.` : `False. Correct: ${sentence}`;
        }
        
        materials.push(item);
      }
    }
  });
  
  return materials;
};

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [documents, setDocuments] = useState([]);
  const [studyMaterials, setStudyMaterials] = useState([]);
  const [currentItem, setCurrentItem] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationTypes, setGenerationTypes] = useState(['flashcard', 'mcq', 'truefalse']);
  const [studyStats, setStudyStats] = useState({ itemsStudied: 0, correctAnswers: 0, streak: 0 });

  useEffect(() => {
    const loadData = () => {
      try {
        const storedDocs = localStorage.getItem('documents');
        const storedMaterials = localStorage.getItem('studyMaterials');
        const storedStats = localStorage.getItem('studyStats');
        
        if (storedDocs) setDocuments(JSON.parse(storedDocs));
        if (storedMaterials) setStudyMaterials(JSON.parse(storedMaterials));
        if (storedStats) setStudyStats(JSON.parse(storedStats));
      } catch (error) {
        console.log('No stored data');
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('documents', JSON.stringify(documents));
      localStorage.setItem('studyMaterials', JSON.stringify(studyMaterials));
      localStorage.setItem('studyStats', JSON.stringify(studyStats));
    } catch (error) {
      console.error('Save error:', error);
    }
  }, [documents, studyMaterials, studyStats]);

  const extractTextFromPDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n\n';
    }
    
    return fullText;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileType = file.name.split('.').pop().toLowerCase();
    let text = '';
    
    try {
      if (fileType === 'pdf') {
        text = await extractTextFromPDF(file);
      } else if (fileType === 'txt') {
        text = await file.text();
      } else {
        alert('Please upload PDF or TXT');
        return;
      }
      
      setDocuments([...documents, {
        id: Date.now(),
        name: file.name,
        type: fileType,
        content: text,
        uploadDate: new Date().toISOString(),
        cardCount: 0,
        pageCount: fileType === 'pdf' ? Math.ceil(text.length / 3000) : 1
      }]);
      
      alert('Document uploaded successfully!');
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    }
  };

  const handleDeleteDocument = (docId) => {
    if (window.confirm('Delete this document?')) {
      setDocuments(documents.filter(d => d.id !== docId));
    }
  };

  const handleClearAllMaterials = () => {
    if (window.confirm('Delete ALL study materials?')) {
      setStudyMaterials([]);
      setCurrentItem(0);
    }
  };

  const handleGenerate = async (docId) => {
    setIsGenerating(true);
    const doc = documents.find(d => d.id === docId);
    
    try {
      const newMaterials = await generateStudyMaterials(doc.content, generationTypes, 15);
      setStudyMaterials([...studyMaterials, ...newMaterials]);
      setDocuments(documents.map(d => d.id === docId ? { ...d, cardCount: newMaterials.length } : d));
      setCurrentPage('study');
    } catch (error) {
      alert('Error generating materials');
    } finally {
      setIsGenerating(false);
    }
  };

  const updateItemSchedule = (item, quality) => {
    let { interval, repetitions, easeFactor } = item;
    
    if (quality >= 3) {
      interval = repetitions === 0 ? 1 : repetitions === 1 ? 6 : Math.round(interval * easeFactor);
      repetitions += 1;
    } else {
      repetitions = 0;
      interval = 1;
    }
    
    easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);
    
    return { ...item, interval, repetitions, easeFactor, nextReview };
  };

  const handleRating = (quality, userAnswer = null) => {
    const currentMaterial = studyMaterials[currentItem];
    let isCorrect = quality >= 3;
    
    if (currentMaterial.type === 'mcq') {
      isCorrect = userAnswer === currentMaterial.correctAnswer;
      quality = isCorrect ? 4 : 2;
    } else if (currentMaterial.type === 'truefalse') {
      isCorrect = userAnswer === currentMaterial.correctAnswer;
      quality = isCorrect ? 4 : 2;
    }
    
    const updatedItem = updateItemSchedule(currentMaterial, quality);
    const newMaterials = [...studyMaterials];
    newMaterials[currentItem] = updatedItem;
    setStudyMaterials(newMaterials);
    
    setStudyStats({
      itemsStudied: studyStats.itemsStudied + 1,
      correctAnswers: studyStats.correctAnswers + (isCorrect ? 1 : 0),
      streak: isCorrect ? studyStats.streak + 1 : 0
    });
    
    setShowAnswer(false);
    setSelectedAnswer(null);
    
    if (currentItem < studyMaterials.length - 1) {
      setCurrentItem(currentItem + 1);
    } else {
      setCurrentPage('dashboard');
    }
  };

  const renderHome = () => (
    <div className="study-container">
      <div className="home-header">
        <h1 className="home-title">Smart Study Assistant</h1>
        <p className="home-subtitle">AI-powered learning with spaced repetition</p>
      </div>

      <div className="documents-section">
        <h2 className="section-title">Your Documents</h2>
        
        {documents.length === 0 ? (
          <div className="empty-state">
            <Upload className="empty-icon" size={48} />
            <p className="empty-text">No documents yet. Upload your first one!</p>
            <label className="btn-primary">
              <input type="file" accept=".txt,.pdf" onChange={handleFileUpload} />
              Upload Document
            </label>
          </div>
        ) : (
          <>
            <div className="document-list">
              {documents.map(doc => (
                <div key={doc.id} className="document-item">
                  <div className="document-info">
                    {doc.type === 'pdf' ? <FileText color="#dc2626" size={20} /> : <File color="#2563eb" size={20} />}
                    <div>
                      <p className="document-name">{doc.name}</p>
                      <p className="document-meta">{doc.cardCount} items • {new Date(doc.uploadDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="document-actions">
                    <div className="checkbox-group">
                      {[['flashcard', 'Cards'], ['mcq', 'MCQ'], ['truefalse', 'T/F']].map(([type, label]) => (
                        <label key={type} className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={generationTypes.includes(type)}
                            onChange={(e) => setGenerationTypes(e.target.checked ? [...generationTypes, type] : generationTypes.filter(t => t !== type))}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <button onClick={() => handleGenerate(doc.id)} disabled={isGenerating || generationTypes.length === 0} className="btn-secondary">
                      {isGenerating ? 'Generating...' : 'Generate'}
                    </button>
                    <button onClick={() => handleDeleteDocument(doc.id)} className="btn-danger" title="Delete">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <label className="btn-primary">
              <Plus size={20} style={{display: 'inline', marginRight: '0.5rem'}} />
              <input type="file" accept=".txt,.pdf" onChange={handleFileUpload} />
              Add Another
            </label>
          </>
        )}
      </div>
    </div>
  );

  const renderStudy = () => {
    if (studyMaterials.length === 0) {
      return (
        <div className="empty-state">
          <Brain className="empty-icon" size={48} />
          <h2>No study materials yet</h2>
          <p className="empty-text">Generate materials from your documents first!</p>
          <button onClick={() => setCurrentPage('home')} className="btn-primary">Go to Documents</button>
        </div>
      );
    }

    const item = studyMaterials[currentItem];

    return (
      <div className="study-container">
        <div className="study-header">
          <div className="study-info">
            Item {currentItem + 1} of {studyMaterials.length} • <strong>{item.type === 'flashcard' ? 'Flashcard' : item.type === 'mcq' ? 'Multiple Choice' : 'True/False'}</strong>
          </div>
          <div className="study-stats">
            <span className="stat-badge blue">Streak: {studyStats.streak}</span>
            <span className="stat-badge green">{studyStats.correctAnswers}/{studyStats.itemsStudied}</span>
          </div>
        </div>

        <div className="study-card">
          <div>
            <div className="text-center">
              <span className={`difficulty-badge ${item.difficulty}`}>{item.difficulty}</span>
            </div>

            <p className="question">{item.question}</p>

            {item.type === 'flashcard' && showAnswer && (
              <div className="answer-box"><p className="answer-text">{item.answer}</p></div>
            )}

            {item.type === 'mcq' && (
              <div className="mcq-options">
                {item.options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => !showAnswer && setSelectedAnswer(option)}
                    disabled={showAnswer}
                    className={`mcq-option ${
                      showAnswer
                        ? option === item.correctAnswer ? 'correct' : option === selectedAnswer ? 'incorrect' : ''
                        : selectedAnswer === option ? 'selected' : ''
                    }`}
                  >
                    <span>{option}</span>
                    {showAnswer && option === item.correctAnswer && <CheckCircle color="#10b981" size={20} />}
                    {showAnswer && option === selectedAnswer && option !== item.correctAnswer && <XCircle color="#ef4444" size={20} />}
                  </button>
                ))}
              </div>
            )}

            {item.type === 'truefalse' && showAnswer && (
              <div className={`feedback-box ${selectedAnswer === item.correctAnswer ? 'correct' : 'incorrect'}`}>
                <div className="feedback-header">
                  {selectedAnswer === item.correctAnswer ? <CheckCircle color="#10b981" size={24} /> : <XCircle color="#ef4444" size={24} />}
                  <span className={`feedback-title ${selectedAnswer === item.correctAnswer ? 'correct' : 'incorrect'}`}>
                    {selectedAnswer === item.correctAnswer ? 'Correct!' : 'Incorrect'}
                  </span>
                </div>
                <p className="feedback-text">{item.explanation}</p>
              </div>
            )}
          </div>

          {item.type === 'flashcard' ? (
            !showAnswer ? (
              <button onClick={() => setShowAnswer(true)} className="submit-button">Show Answer</button>
            ) : (
              <div className="rating-buttons">
                <button onClick={() => handleRating(2)} className="rating-button hard">Hard</button>
                <button onClick={() => handleRating(3)} className="rating-button good">Good</button>
                <button onClick={() => handleRating(4)} className="rating-button easy">Easy</button>
              </div>
            )
          ) : item.type === 'mcq' ? (
            !showAnswer ? (
              <button onClick={() => setShowAnswer(true)} disabled={!selectedAnswer} className="submit-button">Submit Answer</button>
            ) : (
              <button onClick={() => handleRating(4, selectedAnswer)} className="continue-button">Continue</button>
            )
          ) : (
            !showAnswer ? (
              <div className="tf-buttons">
                <button onClick={() => { setSelectedAnswer(true); setShowAnswer(true); }} className="tf-button true">✓ True</button>
                <button onClick={() => { setSelectedAnswer(false); setShowAnswer(true); }} className="tf-button false">✗ False</button>
              </div>
            ) : (
              <button onClick={() => handleRating(4, selectedAnswer)} className="submit-button">Continue</button>
            )
          )}
        </div>
      </div>
    );
  };

  const renderDashboard = () => (
    <div className="dashboard-container">
      <h2 className="dashboard-title">Your Progress</h2>
      
      <div className="stats-grid">
        <div className="stat-card blue">
          <p className="stat-label">Items Studied</p>
          <p className="stat-value">{studyStats.itemsStudied}</p>
        </div>
        <div className="stat-card green">
          <p className="stat-label">Accuracy</p>
          <p className="stat-value">{studyStats.itemsStudied > 0 ? Math.round((studyStats.correctAnswers / studyStats.itemsStudied) * 100) : 0}%</p>
        </div>
        <div className="stat-card purple">
          <p className="stat-label">Current Streak</p>
          <p className="stat-value">{studyStats.streak}</p>
        </div>
      </div>

      <div className="summary-card">
        <div className="summary-header">
          <h3 className="summary-title">Study Summary</h3>
          {studyMaterials.length > 0 && (
            <button onClick={handleClearAllMaterials} className="clear-button">
              <Trash2 size={16} /> Clear All
            </button>
          )}
        </div>
        <div className="summary-list">
          <div className="summary-item">
            <span className="summary-label">Total Study Materials</span>
            <span className="summary-value">{studyMaterials.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Documents</span>
            <span className="summary-value">{documents.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Success Rate</span>
            <span className="summary-value">{studyStats.itemsStudied > 0 ? `${Math.round((studyStats.correctAnswers / studyStats.itemsStudied) * 100)}%` : 'N/A'}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-actions">
        <button onClick={() => { setCurrentItem(0); setShowAnswer(false); setSelectedAnswer(null); setCurrentPage('study'); }} className="btn-flex primary">
          <Play size={20} /> Continue Studying
        </button>
        <button onClick={() => setCurrentPage('home')} className="btn-flex secondary">Back to Home</button>
      </div>
    </div>
  );

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-container">
          <div className="nav-logo">
            <Brain color="#2563eb" size={32} />
            <span className="nav-title">Smart Study</span>
          </div>
          <div className="nav-buttons">
            <button onClick={() => setCurrentPage('home')} className={`nav-button ${currentPage === 'home' ? 'active' : ''}`}>
              <BookOpen size={20} /> Documents
            </button>
            <button onClick={() => setCurrentPage('study')} className={`nav-button ${currentPage === 'study' ? 'active' : ''}`}>
              <Play size={20} /> Study
            </button>
            <button onClick={() => setCurrentPage('dashboard')} className={`nav-button ${currentPage === 'dashboard' ? 'active' : ''}`}>
              <BarChart3 size={20} /> Progress
            </button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        {currentPage === 'home' && renderHome()}
        {currentPage === 'study' && renderStudy()}
        {currentPage === 'dashboard' && renderDashboard()}
      </main>
    </div>
  );
}

export default App;