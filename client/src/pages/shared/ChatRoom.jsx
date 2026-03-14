import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { Loader2, SendHorizonal, ImagePlus, X } from 'lucide-react';

const ChatRoom = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { chatId } = useParams();
  const isDoctor = user?.role === 'DOCTOR';
  const mediaBaseUrl = String(axios.defaults.baseURL || '').replace(/\/api\/?$/, '');

  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState([]);
  const [patientConversations, setPatientConversations] = useState([]);
  const [activeChatId, setActiveChatId] = useState(chatId || '');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState('');
  const [sending, setSending] = useState(false);
  const imageInputRef = useRef(null);

  const loadChats = async () => {
    try {
      const res = await axios.get('/chats/my-chats');
      const list = res.data || [];
      setChats(list);

      if (!activeChatId) {
        if (chatId && list.some((c) => c.id === chatId)) setActiveChatId(chatId);
        else if (list[0]?.id) setActiveChatId(list[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadPatientConversations = async () => {
    if (isDoctor) return;
    try {
      const res = await axios.get('/chats/patient/conversations');
      setPatientConversations(res.data || []);
    } catch (err) {
      console.error(err);
      setPatientConversations([]);
    }
  };

  const loadMessages = async (id) => {
    if (!id) return;
    try {
      const res = await axios.get(`/chats/${id}/messages`);
      setMessages(res.data || []);
    } catch (err) {
      console.error(err);
      setMessages([]);
    }
  };

  useEffect(() => {
    const boot = async () => {
      try {
        setLoading(true);
        await Promise.all([loadChats(), loadPatientConversations()]);
      } finally {
        setLoading(false);
      }
    };
    boot();
  }, []);

  useEffect(() => {
    if (!activeChatId) return;
    loadMessages(activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    const t = setInterval(async () => {
      await loadChats();
      await loadPatientConversations();
      if (activeChatId) await loadMessages(activeChatId);
    }, 3000);
    return () => clearInterval(t);
  }, [activeChatId]);

  useEffect(() => {
    if (!chatId || activeChatId === chatId) return;
    setActiveChatId(chatId);
  }, [chatId]);

  const activeChat = useMemo(() => chats.find((c) => c.id === activeChatId) || null, [chats, activeChatId]);

  const sendMessage = async () => {
    if (!activeChatId || sending || (!text.trim() && !selectedImage)) return;
    try {
      setSending(true);
      if (selectedImage) {
        const fd = new FormData();
        fd.append('text', text.trim());
        fd.append('image', selectedImage);
        await axios.post(`/chats/${activeChatId}/messages`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await axios.post(`/chats/${activeChatId}/messages`, { text: text.trim() });
      }
      setText('');
      setSelectedImage(null);
      setSelectedImagePreview('');
      if (imageInputRef.current) imageInputRef.current.value = '';
      await loadMessages(activeChatId);
      await loadChats();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatDoctorName = (name) => {
    const clean = String(name || '').replace(/^\s*((dr|doctor)\.?\s*)+/i, '').trim();
    return clean ? `Dr. ${clean}` : 'Doctor';
  };

  const avatarFor = (person, fallback = 'user') => {
    const seed = encodeURIComponent(String(person?.name || fallback));
    return person?.profilePic || `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}`;
  };

  const title = isDoctor ? 'Patient Chats' : 'Doctor Chats';

  const requestChatForDoctor = async (doctorId) => {
    try {
      await axios.post(`/chats/request/${doctorId}`);
      await loadPatientConversations();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to request chat');
    }
  };

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    setSelectedImage(file);
    const previewUrl = URL.createObjectURL(file);
    setSelectedImagePreview(previewUrl);
  };

  const clearPickedImage = () => {
    if (selectedImagePreview) URL.revokeObjectURL(selectedImagePreview);
    setSelectedImage(null);
    setSelectedImagePreview('');
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  useEffect(() => () => {
    if (selectedImagePreview) URL.revokeObjectURL(selectedImagePreview);
  }, [selectedImagePreview]);

  return (
    <Layout title={title} subtitle="Temporary chat rooms with instant messaging.">
      {loading ? (
        <div className="flex items-center justify-center p-16 text-slate-500 gap-3">
          <Loader2 className="animate-spin" size={24} /> Loading chats...
        </div>
      ) : (
        <div className="h-[calc(100vh-150px)] bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-3">
          <div className="border-r border-slate-200 bg-slate-50/80">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-display font-bold text-slate-800">Conversations</h3>
            </div>
            <div className="overflow-auto h-[calc(100%-65px)]">
              {isDoctor ? (chats.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No active chats.</p>
              ) : chats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setActiveChatId(c.id);
                    navigate(isDoctor ? `/doctor/chats/${c.id}` : `/patient/chats/${c.id}`);
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 ${activeChatId === c.id ? 'bg-white' : 'hover:bg-white/80'}`}
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={avatarFor(c.peer, 'user')}
                      alt={c.peer?.name || 'User'}
                      className="h-8 w-8 rounded-full border border-slate-200 bg-white object-cover"
                    />
                    <p className="font-semibold text-slate-800 truncate">{c.peer?.name}</p>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-1">{c.lastMessage || 'No messages yet'}</p>
                </button>
              ))) : (patientConversations.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No doctor conversations yet.</p>
              ) : patientConversations.map((c) => (
                <div key={`pc-${c.doctorId}`} className={`px-4 py-3 border-b border-slate-100 ${activeChatId === c.requestId ? 'bg-white' : 'hover:bg-white/80'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <img
                          src={avatarFor(c.peer, 'doctor')}
                          alt={c.peer?.name || 'Doctor'}
                          className="h-8 w-8 rounded-full border border-slate-200 bg-white object-cover"
                        />
                        <p className="font-semibold text-slate-800 truncate">{formatDoctorName(c.peer?.name)}</p>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-1">{c.lastMessage || (c.status === 'PENDING' ? 'Chat request pending...' : c.status === 'DENIED' ? 'Previous request denied' : c.status === 'EXPIRED' ? 'Previous chat expired' : 'No active chat')}</p>
                    </div>

                    {c.status === 'ACCEPTED' && c.requestId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveChatId(c.requestId);
                          navigate(`/patient/chats/${c.requestId}`);
                        }}
                        className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-primary text-white"
                      >
                        Open
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => requestChatForDoctor(c.doctorId)}
                        disabled={c.status === 'PENDING'}
                        className="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary disabled:opacity-60"
                      >
                        {c.status === 'PENDING' ? 'Pending' : 'Request Chat'}
                      </button>
                    )}
                  </div>
                </div>
              )))}
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col bg-[#efeae2]">
            {!activeChat ? (
              <div className="flex-1 flex items-center justify-center text-slate-500 font-medium">
                Select a chat to start messaging.
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={avatarFor(activeChat.peer, 'chat-user')}
                      alt={activeChat.peer?.name || 'User'}
                      className="h-9 w-9 rounded-full border border-slate-200 bg-white object-cover"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{isDoctor ? activeChat.peer?.name : formatDoctorName(activeChat.peer?.name)}</p>
                      <p className="text-xs text-slate-500">Chat expires: {activeChat.expiresAt ? new Date(activeChat.expiresAt).toLocaleString() : '—'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-4 space-y-2">
                  {messages.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center mt-10">No messages yet. Say hello 👋</p>
                  ) : messages.map((m) => {
                    const mine = String(m.senderId) === String(user?.id);
                    return (
                      <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${mine ? 'bg-[#d9fdd3] text-slate-800 rounded-br-md' : 'bg-white text-slate-800 rounded-bl-md'}`}>
                          {m.imageUrl && (
                            <a href={`${mediaBaseUrl}${m.imageUrl}`} target="_blank" rel="noreferrer" className="block mb-2">
                              <img
                                src={`${mediaBaseUrl}${m.imageUrl}`}
                                alt="Chat attachment"
                                className="max-h-64 w-auto rounded-xl border border-slate-200 object-cover"
                              />
                            </a>
                          )}
                          {m.text ? <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p> : null}
                          <p className="text-[10px] text-slate-500 mt-1 text-right">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-3 bg-white border-t border-slate-200 flex items-end gap-2">
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="h-11 w-11 inline-flex items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:border-primary/40 hover:text-primary"
                    title="Send image"
                  >
                    <ImagePlus size={18} />
                  </button>
                  <textarea
                    rows={2}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 rounded-2xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={sending || (!text.trim() && !selectedImage)}
                    className="h-11 w-11 inline-flex items-center justify-center rounded-full bg-primary text-white disabled:opacity-50"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <SendHorizonal size={16} />}
                  </button>
                </div>
                {selectedImagePreview && (
                  <div className="px-3 pb-3 bg-white border-t border-slate-100">
                    <div className="inline-flex items-start gap-2 rounded-xl border border-slate-200 p-2 bg-slate-50">
                      <img src={selectedImagePreview} alt="Selected" className="h-16 w-16 rounded-lg object-cover border border-slate-200" />
                      <div>
                        <p className="text-xs font-semibold text-slate-700 max-w-[220px] truncate">{selectedImage?.name || 'image'}</p>
                        <p className="text-[11px] text-slate-500">Ready to send</p>
                      </div>
                      <button type="button" onClick={clearPickedImage} className="h-6 w-6 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-white">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ChatRoom;
