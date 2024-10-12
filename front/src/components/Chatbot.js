import React, { useState, useRef } from "react";
import Sidebar from "./Sidebar";
import { RemoteRunnable } from "@langchain/core/runnables/remote";
import { Button, CircularProgress, Typography } from "@mui/material";

// Création d'une instance RemoteRunnable pour communiquer avec le serveur LangServe
const chain = new RemoteRunnable({ url: "http://localhost:8001/rag/c/N4XyA/" });

const Chatbot = () => {
    const [messages, setMessages] = useState([
        { role: "assistant", content: "Bonjour ! Comment puis-je vous aider aujourd'hui ?" },
    ]);
    const [input, setInput] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState("");

    // Définir les refs
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    const handleSend = async () => {
        if (input.trim() === "") return;

        const userMessage = { role: "human", content: input };
        setMessages((prevMessages) => [...prevMessages, userMessage]);
        setInput("");

        try {
            // Invocation de la chaîne LangServe avec l'historique des messages
            const response = await chain.invoke({
                messages: messages.concat(userMessage),
            });

            console.log("Réponse reçue:", response.content);
            // Ajout de la réponse du bot à l'historique des messages
            setMessages((prevMessages) => [
                ...prevMessages,
                { role: response.role, content: response.content },
            ]);
        } catch (error) {
            console.error("Erreur:", error);
            setMessages((prevMessages) => [
                ...prevMessages,
                { role: "assistant", content: "Désolé, une erreur s'est produite." },
            ]);
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            if (mediaRecorderRef.current) {
                console.log("Arrêt de l'enregistrement...");
                mediaRecorderRef.current.stop();
            }
            setIsRecording(false);
            setStatus("Enregistrement terminé, envoi en cours...");
        } else {
            navigator.mediaDevices
                .getUserMedia({ audio: true })
                .then((stream) => {
                    mediaRecorderRef.current = new MediaRecorder(stream);
                    mediaRecorderRef.current.start();

                    console.log("Enregistrement démarré...");
                    setIsRecording(true);
                    setStatus("Enregistrement en cours...");

                    mediaRecorderRef.current.addEventListener("dataavailable", (event) => {
                        audioChunksRef.current.push(event.data);
                        console.log("Données audio disponibles:", event.data);
                    });

                    mediaRecorderRef.current.addEventListener("stop", () => {
                        console.log("Enregistrement arrêté, envoi des données...");
                        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/mp3" });
                        sendAudioToServer(audioBlob);
                        audioChunksRef.current = [];
                    });
                })
                .catch((error) => {
                    console.error("Erreur lors de l'accès au microphone:", error);
                    setStatus("Erreur lors de l'accès au microphone.");
                });
        }
    };

    const sendAudioToServer = (audioBlob) => {
        console.log("Envoi de l'audio au serveur...");
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.mp3");

        fetch("http://localhost:8000/transcribe", {
            method: "POST",
            body: formData,
        })
            .then((response) => {
                console.log("Réponse brute du serveur:", response);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then((data) => {
                console.log("Données de transcription reçues:", data);
                if (data.error) {
                    setStatus(`Erreur : ${data.error}`);
                } else {
                    setInput(data.transcription);
                    setStatus("");
                }
            })
            .catch((error) => {
                console.error("Erreur lors de la transcription:", error);
                setStatus(`Erreur : ${error.message}`);
            });
    };

    return (
        <div className="flex h-screen bg-gradient-to-b from-blue-100 to-white">
            <Sidebar />
            <div className="flex-1 p-4 ml-48">
                <div className="bg-white rounded-lg shadow-lg p-4 h-[calc(100vh-2rem)] flex flex-col">
                    <div className="flex-1 overflow-y-auto mb-4">
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={`mb-4 ${message.role === "human" ? "text-right" : "text-left"}`}
                            >
                                <div
                                    className={`inline-block p-3 rounded-lg ${
                                        message.role === "human" ? "bg-blue-600 text-white" : "bg-gray-200 text-blue-800"
                                    }`}
                                >
                                    {message.content}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && handleSend()}
                            placeholder="Tapez votre message..."
                            className="flex-1 p-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <Button
                            variant="contained"
                            color={isRecording ? "secondary" : "primary"}
                            onClick={toggleRecording}
                            style={{ margin: "0 10px" }}
                        >
                            {isRecording ? "Arrêter" : "Enregistrer"}
                        </Button>
                        <button
                            onClick={handleSend}
                            className="bg-blue-600 text-white p-2 rounded-r-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            Envoyer
                        </button>
                    </div>
                    {status && (
                        <div className="flex items-center justify-center mt-2">
                            <CircularProgress size={20} style={{ marginRight: "10px" }} />
                            <Typography variant="body1">{status}</Typography>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Chatbot;