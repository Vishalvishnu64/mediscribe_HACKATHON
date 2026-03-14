import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { Loader2, SendHorizonal } from 'lucide-react';

const ChatRoom = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { chatId } = useParams();
  const isDoctor = user?.role === 'DOCTOR';

  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(chatId || '');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

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
        await loadChats();
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
    if (!activeChatId || !text.trim() || sending) return;
    try {
      setSending(true);
      await axios.post(`/chats/${activeChatId}/messages`, { text: text.trim() });
      setText('');
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

  const title = isDoctor ? 'Patient Chats' : 'Doctor Chats';

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
              {chats.length === 0 ? (
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
                  <p className="font-semibold text-slate-800 truncate">
                    {isDoctor ? c.peer?.name : formatDoctorName(c.peer?.name)}
                  </p>
                  <p className="text-xs text-slate-500 truncate mt-1">{c.lastMessage || 'No messages yet'}</p>
                </button>
              ))}
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
                  <div>
                    <p className="font-bold text-slate-800">{isDoctor ? activeChat.peer?.name : formatDoctorName(activeChat.peer?.name)}</p>
                    <p className="text-xs text-slate-500">Chat expires: {activeChat.expiresAt ? new Date(activeChat.expiresAt).toLocaleString() : '—'}</p>
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
                          <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                          <p className="text-[10px] text-slate-500 mt-1 text-right">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-3 bg-white border-t border-slate-200 flex items-end gap-2">
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
                    disabled={sending || !text.trim()}
                    className="h-11 w-11 inline-flex items-center justify-center rounded-full bg-primary text-white disabled:opacity-50"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <SendHorizonal size={16} />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ChatRoom;
