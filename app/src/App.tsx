import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Mic,
  Trophy,
  Building2,
  ChevronRight,
  ChevronLeft,
  Home,
  ShoppingBag,
  ShoppingCart,
  Search,
  Plus,
  MapPin,
  Star,
  Sparkles
} from 'lucide-react';

type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
};

type Scene = 'tour' | 'hotel';
type Tab = 'home' | 'mall';
type HomeView = 'landing' | 'chat' | 'hotel';

const BASE = import.meta.env.BASE_URL;

/* ---------------- 通用对话会话 Hook ---------------- */
function useChatSession(scene: Scene, presetAnswers: Record<string, string>) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const send = async (text: string) => {
    if (!text.trim() || isGenerating) return;
    const normalizedText = text.trim();

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: normalizedText };
    setMessages(prev => [...prev, userMessage]);

    // 本地预设答案，响应更快
    if (presetAnswers[normalizedText]) {
      const modelMessageId = (Date.now() + 1).toString();
      setIsGenerating(true);
      setTimeout(() => {
        setMessages(prev => [...prev, { id: modelMessageId, role: 'model', content: presetAnswers[normalizedText] }]);
        setIsGenerating(false);
      }, 500);
      return;
    }

    setIsGenerating(true);
    const modelMessageId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: modelMessageId, role: 'model', content: '' }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: normalizedText,
          scene,
          history: messages.map(m => ({ role: m.role, content: m.content }))
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("🚨 API免费额度已耗尽 (429)。请稍后再试或检查计费状态。");
        }
        throw new Error('网络请求失败，请重试');
      }
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              if (dataStr === '[DONE]') { done = true; break; }
              try {
                const data = JSON.parse(dataStr);
                setMessages(prev => prev.map(msg =>
                  msg.id === modelMessageId ? { ...msg, content: msg.content + data.text } : msg
                ));
              } catch (e) {
                console.error("Error parsing stream data:", e);
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error(error);
      const errorMsg = error instanceof Error ? error.message : "抱歉，出错了，请稍后再试。";
      setMessages(prev => prev.map(msg =>
        msg.id === modelMessageId ? { ...msg, content: errorMsg } : msg
      ));
    } finally {
      setIsGenerating(false);
    }
  };

  return { messages, isGenerating, send };
}

/* ---------------- 消息气泡列表 ---------------- */
function MessageList({ messages, isGenerating }: { messages: Message[]; isGenerating: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  return (
    <div className="space-y-5 px-4 py-4">
      {messages.map((message) => (
        <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {message.role === 'user' ? (
            <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm max-w-[82%] shadow text-[15px] leading-relaxed">
              {message.content}
            </div>
          ) : (
            <div className="px-2 py-1 max-w-[96%] text-gray-800 markdown-body">
              {message.content ? (
                <ReactMarkdown>{message.content}</ReactMarkdown>
              ) : (
                <div className="flex items-center space-x-1.5 h-6 px-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      <div ref={endRef} className="h-2" />
    </div>
  );
}

/* ---------------- 底部输入栏 ---------------- */
function ChatInput({
  value, onChange, onSend, disabled, placeholder
}: {
  value: string; onChange: (v: string) => void; onSend: () => void; disabled: boolean; placeholder: string;
}) {
  return (
    <div className="bg-white/95 backdrop-blur border-t border-gray-200/60 px-4 py-3 shrink-0">
      <div className="flex items-center space-x-3 bg-white border border-gray-200/80 rounded-full px-4 py-2.5 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
        <button className="text-gray-500 hover:text-gray-700 transition-colors p-1 rounded-full flex-shrink-0">
          <Mic className="w-5 h-5" />
        </button>
        <input
          type="text"
          className="flex-1 bg-transparent border-none outline-none text-gray-800 placeholder-gray-400 disabled:opacity-50 min-w-0 text-xs"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSend(); }}
          disabled={disabled}
        />
        <button
          onClick={onSend}
          disabled={!value.trim() || disabled}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed text-white p-2.5 rounded-full transition-colors flex flex-shrink-0 items-center justify-center shadow-sm"
        >
          <Send className="w-4 h-4 ml-0.5" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- 商城数据 ---------------- */
type Product = {
  id: number; name: string; emoji: string; category: string;
  price: number; tag: string; sales: string; gradient: string;
};

const PRODUCTS: Product[] = [
  { id: 1, name: '白切文昌鸡礼盒装', emoji: '🍗', category: '文昌美食', price: 128, tag: '产地直供', sales: '月售2000+', gradient: 'from-amber-100 to-orange-200' },
  { id: 2, name: '盐焗文昌鸡（整只）', emoji: '🍗', category: '文昌美食', price: 68, tag: '老字号', sales: '月售1500+', gradient: 'from-yellow-100 to-amber-200' },
  { id: 3, name: '文昌胡椒（特级）', emoji: '🌶️', category: '文昌美食', price: 26, tag: '地理标志', sales: '月售800+', gradient: 'from-red-100 to-rose-200' },
  { id: 4, name: '传统椰子糖 500g', emoji: '🥥', category: '椰子好物', price: 19.9, tag: '童年味道', sales: '月售3000+', gradient: 'from-emerald-100 to-teal-200' },
  { id: 5, name: '冷榨椰子油 250ml', emoji: '🥥', category: '椰子好物', price: 45, tag: '东郊椰林', sales: '月售600+', gradient: 'from-cyan-100 to-sky-200' },
  { id: 6, name: '速溶椰子粉 400g', emoji: '🥥', category: '椰子好物', price: 32, tag: '椰香浓郁', sales: '月售1200+', gradient: 'from-lime-100 to-green-200' },
  { id: 7, name: '长征火箭模型摆件', emoji: '🚀', category: '航天文创', price: 99, tag: '航天城限定', sales: '月售400+', gradient: 'from-blue-100 to-indigo-200' },
  { id: 8, name: '文昌星IP公仔', emoji: '🧸', category: '航天文创', price: 59, tag: '官方正版', sales: '月售900+', gradient: 'from-violet-100 to-purple-200' },
  { id: 9, name: '马鲛鱼干 500g', emoji: '🐟', category: '海鲜干货', price: 88, tag: '渔民自晒', sales: '月售500+', gradient: 'from-slate-100 to-gray-200' },
  { id: 10, name: '淡干虾皮 250g', emoji: '🦐', category: '海鲜干货', price: 39, tag: '鲜味十足', sales: '月售700+', gradient: 'from-orange-100 to-amber-200' },
];

const CATEGORIES = ['全部', '文昌美食', '椰子好物', '航天文创', '海鲜干货'];

/* ---------------- 主应用 ---------------- */
export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [homeView, setHomeView] = useState<HomeView>('landing');
  const [landingCard, setLandingCard] = useState<'scenic' | 'hotel'>('scenic');
  const [input, setInput] = useState('');
  const [hotelInput, setHotelInput] = useState('');
  const [activeCategory, setActiveCategory] = useState('全部');
  const [cartCount, setCartCount] = useState(0);
  const [toast, setToast] = useState('');

  const tourPresetAnswers: Record<string, string> = {
    "你好": "你好！我是您的文昌旅游小助手文昌星 🌴 很高兴为您服务！无论是景点推荐、美食打卡，还是行程规划，您都可以随时问我哦！",
    "文昌必玩的景点有哪些？": `**来文昌，这些景点一定不能错过 🌴🚀**

**1. 文昌航天发射场 & 航天科普中心** 🚀
*   中国首个滨海发射场，近距离感受大国重器，运气好还能赶上火箭发射！

**2. 东郊椰林** 🥥
*   绵延十里的椰林海岸线，喝一个现摘椰子，感受最地道的椰风海韵。

**3. 铜鼓岭** ⛰️
*   登顶俯瞰月亮湾全景，海天一色，被誉为"琼东第一峰"。

**4. 石头公园** 🪨
*   海浪拍打亿年礁石，壮观又出片，摄影爱好者的天堂。

**5. 文昌孔庙 & 骑楼老街** 🏛️
*   海南保存最完整的古建筑群之一，漫步文南老街感受南洋侨乡文化。

**6. 月亮湾** 🌙
*   人少景美的原生态海湾，看日落的绝佳去处。

💡 时间紧的话，推荐「航天科普中心 + 东郊椰林」一日游组合；两天的话可以加上铜鼓岭和石头公园。需要我帮你规划具体行程吗？`,
    "文昌2日游怎么安排？": `**文昌2日游经典路线推荐：**

**第一天：航天科技与椰林风情**
*   **上午：文昌航天科普中心**
    *   近距离观看航天发射塔架，了解中国航天发展史。建议提前预约门票。
*   **中午：品尝地道文昌鸡**
    *   前往市区或潭牛镇，找一家老字号品尝最正宗的白切文昌鸡。
*   **下午：东郊椰林**
    *   在绵延十里的椰林中漫步，感受浓郁的热带海岛风情，品尝新鲜椰子水。
*   **晚上：环球码头海鲜夜市**
    *   体验当地人的夜生活，挑选新鲜海鲜加工，价格实惠。

**第二天：历史文化与自然奇观**
*   **上午：文昌孔庙与骑楼老街**
    *   参观海南保存最完整的古建筑群之一文昌孔庙，随后漫步文南老街，感受南洋侨乡文化。
*   **中午：老街抱罗粉**
    *   品尝海南四大名粉之一的抱罗粉，配上美味的牛肉干和花生。
*   **下午：铜鼓岭与石头公园**
    *   登铜鼓岭俯瞰月亮湾全景，风光旖旎。随后前往石头公园，欣赏海浪拍打奇特礁石的壮美景观。

**交通建议：**
*   自驾是最便利的方式，各个景点之间距离适中。
*   如果没有自驾，也可以在高铁文昌站出站后乘坐公交或打车。

祝您在文昌不仅能大饱口福，也能大饱眼福！`
  };

  const hotelPresetAnswers: Record<string, string> = {
    "你好": "您好！我是酒店智能体 🏨 可以帮您查询房态、介绍房型、推荐周边玩法，有什么可以帮您？",
  };

  const tour = useChatSession('tour', tourPresetAnswers);
  const hotel = useChatSession('hotel', hotelPresetAnswers);

  const suggestedQuestions = [
    "文昌2日游怎么安排？",
    "规划一个包含东郊椰林、石头公园的路线",
    "帮我介绍一下文昌航天发射场",
    "想吃正宗文昌鸡，求推荐老字号美食",
    "文昌骑楼老街有什么特色？"
  ];

  const hotelSuggestedQuestions = [
    "瑶光小阁还有房吗？",
    "有能看到火箭发射的海景房吗？",
    "酒店含早餐吗？有接送服务吗？",
    "从酒店到航天科普中心怎么走？"
  ];

  /* 必玩：跳转问答并自动回答必玩问题 */
  const BIWAN_QUESTION = "文昌必玩的景点有哪些？";
  const handleBiwan = () => {
    setTab('home');
    setHomeView('chat');
    tour.send(BIWAN_QUESTION);
  };

  const handleLandingSend = () => {
    const text = input;
    setInput('');
    setHomeView('chat');
    tour.send(text);
  };

  const addToCart = (name: string) => {
    setCartCount(c => c + 1);
    setToast(`已加入购物车：${name}`);
    setTimeout(() => setToast(''), 1600);
  };

  const filteredProducts = activeCategory === '全部'
    ? PRODUCTS
    : PRODUCTS.filter(p => p.category === activeCategory);

  const showTabBar = tab === 'mall' || (tab === 'home' && homeView === 'landing');

  return (
    <div className="w-full min-h-screen bg-gray-900 flex items-center justify-center overflow-hidden">
      <div className="w-full max-w-[430px] h-screen relative font-sans bg-[#f2f6fc] shadow-2xl overflow-hidden flex flex-col">

        {/* ================= 首页 · Landing ================= */}
        {tab === 'home' && homeView === 'landing' && (
          <>
            <div className="flex-1 overflow-y-auto flex flex-col">
              {/* 头部：横幅为实高容器（文档流），标题 + 头像置于其中，下方内容天然衔接不遮挡 */}
              <div className="relative h-[150px] shrink-0 overflow-hidden">
                <img
                  src={`${BASE}bg.jpg`}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none select-none"
                />
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#f2f6fc] to-transparent pointer-events-none"></div>
                <div className="relative h-full px-5 flex items-center justify-between">
                  <div className="flex flex-col">
                    <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight drop-shadow-sm">文昌星</h1>
                    <span className="text-lg text-gray-600 font-medium mt-0.5">伴您游文昌</span>
                  </div>
                  <img
                    src={`${BASE}avatar.png`}
                    alt="文昌星"
                    className="w-20 h-20 object-contain drop-shadow-lg"
                  />
                </div>
              </div>

              {/* 中部：菜单横排 + 风景大卡（紧随横幅之后，零遮挡） */}
              <div className="px-4 mt-3 shrink-0">
                {/* 横排菜单：必玩 / 酒店（均为原地切换，点卡片才进功能页） */}
                <div className="flex space-x-3 mb-3">
                  <button
                    onClick={() => setLandingCard('scenic')}
                    className={`flex-1 rounded-2xl shadow-sm py-2.5 flex items-center justify-center space-x-2 hover:shadow-md transition-all active:scale-95 ${
                      landingCard === 'scenic'
                        ? 'bg-white border-2 border-blue-500/70'
                        : 'bg-white border border-gray-100'
                    }`}
                  >
                    <Trophy className="w-5 h-5 text-amber-500" />
                    <span className={`text-sm font-bold ${landingCard === 'scenic' ? 'text-blue-600' : 'text-gray-600'}`}>必玩</span>
                  </button>
                  <button
                    onClick={() => setLandingCard('hotel')}
                    className={`flex-1 rounded-2xl shadow-sm py-2.5 flex items-center justify-center space-x-2 hover:shadow-md transition-all active:scale-95 ${
                      landingCard === 'hotel'
                        ? 'bg-white border-2 border-blue-500/70'
                        : 'bg-white border border-gray-100'
                    }`}
                  >
                    <Building2 className="w-5 h-5 text-blue-500" />
                    <span className={`text-sm font-bold ${landingCard === 'hotel' ? 'text-blue-600' : 'text-gray-600'}`}>酒店</span>
                  </button>
                </div>

                {/* 大卡：必玩=地图海报 / 酒店=酒店卡片，原地切换 */}
                {landingCard === 'scenic' ? (
                  <button
                    onClick={handleBiwan}
                    className="w-full bg-white rounded-[28px] shadow-xl overflow-hidden text-left hover:shadow-2xl transition-all active:scale-[0.99]"
                  >
                    <img
                      src={`${BASE}scenic.jpg`}
                      alt="文昌地图"
                      className="w-full h-auto block"
                    />
                    <div className="px-4 py-3.5 flex items-center justify-between">
                      <div>
                        <div className="text-blue-600 text-sm font-semibold mb-0.5">@文昌星：</div>
                        <div className="text-gray-700 text-[15px]">{BIWAN_QUESTION}</div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 ml-3">
                        <ChevronRight className="w-5 h-5 text-blue-600" />
                      </div>
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={() => setHomeView('hotel')}
                    className="w-full bg-white rounded-[28px] shadow-xl overflow-hidden text-left hover:shadow-2xl transition-all active:scale-[0.99]"
                  >
                    <div className="relative">
                      <img
                        src={`${BASE}hotel.jpg`}
                        alt="瑶光小阁"
                        className="w-full h-auto block"
                      />
                      <div className="absolute top-3 right-3 flex items-center space-x-1 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full shadow-sm">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span className="text-xs font-bold text-amber-600">4.8</span>
                      </div>
                    </div>
                    <div className="px-4 py-3.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-extrabold text-gray-800 text-lg">瑶光小阁 · 航天小镇民宿</div>
                          <div className="flex items-center space-x-1 text-xs text-gray-500 mt-1">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>龙楼镇 · 近铜鼓岭/航天发射场</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <span className="text-red-500 font-extrabold text-xl">¥328</span>
                          <span className="text-xs text-gray-400"> 起/晚</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <div className="flex flex-wrap gap-1.5">
                          {['观箭海景房', '含双早', '发射观礼接送'].map(t => (
                            <span key={t} className="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{t}</span>
                          ))}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 ml-3">
                          <ChevronRight className="w-5 h-5 text-blue-600" />
                        </div>
                      </div>
                    </div>
                  </button>
                )}
              </div>
              <div className="flex-1" />
            </div>

            {/* 底部输入栏 */}
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={handleLandingSend}
              disabled={tour.isGenerating}
              placeholder="给文昌星布置一个任务"
            />
          </>
        )}

        {/* ================= 首页 · 问答（合并到首页） ================= */}
        {tab === 'home' && homeView === 'chat' && (
          <>
            {/* 返回钮固定浮层（不随滚动） */}
            <button
              onClick={() => setHomeView('landing')}
              className="absolute top-3 left-3 z-20 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-gray-700" />
            </button>

            {/* 横幅+内容同一滚动流：图片随内容一起滚走，文字不会滚进图里 */}
            <div className="flex-1 overflow-y-auto bg-[#edf2f9]">
              <div className="relative">
                <div className="h-[200px] overflow-hidden">
                  <img
                    src={`${BASE}chat-bg.png`}
                    alt=""
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              </div>
              <div className="pt-4">
                {/* 介绍区常驻：横幅下方始终显示（不随消息有无隐藏） */}
                <div className="px-4 space-y-3">
                  {/* 标题卡 */}
                  <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm border border-white/60 px-4 py-3.5">
                    <div className="flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-blue-500" />
                      <span className="text-[15px] font-bold text-gray-800">旅行规划小助手</span>
                    </div>
                    <div className="text-sm text-gray-400 mt-0.5">旅行规划智能体，定制您的文昌之旅</div>
                  </div>
                  {/* 文昌星介绍 */}
                  <div className="bg-white/90 backdrop-blur rounded-3xl shadow-sm border border-white/60 px-5 py-4 text-[17px] text-gray-800 leading-relaxed">
                    嗨，我是你的AI旅行小助手文昌星！✨ 无论你想制定行程🗺️、挖掘小众景点🌴，还是了解当地美食🍗，我都能帮你轻松搞定！需要推荐目的地、旅行贴士随时告诉我哦~😊 今天想聊点什么呢？
                  </div>
                  {/* 常搜问题 */}
                  <div className="flex flex-col items-start space-y-4 pt-2">
                    {[
                      '文昌必玩的景点有哪些？',
                      '文昌航天发射场怎么参观？',
                      '文昌有哪些特色美食？',
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => tour.send(q)}
                        className="bg-white/90 backdrop-blur rounded-full shadow-sm border border-white/60 px-5 py-3 text-[17px] text-gray-800 hover:shadow-md active:scale-95 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
                <MessageList messages={tour.messages} isGenerating={tour.isGenerating} />
              </div>
            </div>

            {/* 底部快捷标签（常驻） */}
            <div className="shrink-0 px-4 pb-2 flex space-x-2 overflow-x-auto bg-[#edf2f9]">
              {['启发我去哪', '著名景点', '风味文昌', '景区导览'].map((q) => (
                <button
                  key={q}
                  onClick={() => tour.send(q)}
                  className="shrink-0 bg-white/85 backdrop-blur rounded-full shadow-sm border border-white/60 px-4 py-2 text-sm text-gray-700 hover:shadow-md active:scale-95 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>

            <ChatInput
              value={input}
              onChange={setInput}
              onSend={() => { const t = input; setInput(''); tour.send(t); }}
              disabled={tour.isGenerating}
              placeholder="请输入您想探索的文昌景点、美食或旅游需求..."
            />
          </>
        )}

        {/* ================= 酒店智能体 ================= */}
        {tab === 'home' && homeView === 'hotel' && (
          <>
            <div className="bg-white/95 backdrop-blur border-b border-gray-100 px-3 py-3 flex items-center space-x-2 shrink-0 shadow-sm">
              <button
                onClick={() => setHomeView('landing')}
                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="w-6 h-6 text-gray-700" />
              </button>
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-gray-800 text-[15px] leading-tight">酒店智能体</div>
                <div className="text-xs text-gray-400">房态查询 / 房型介绍 / 周边玩法</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* 酒店卡片 */}
              <div className="px-4 pt-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <img src={`${BASE}hotel.jpg`} alt="瑶光小阁" className="w-full h-44 object-cover" />
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg">瑶光小阁 · 航天小镇民宿</h3>
                        <div className="flex items-center space-x-1 text-xs text-gray-500 mt-1">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>龙楼镇 · 近铜鼓岭/航天发射场</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 bg-amber-50 px-2 py-1 rounded-lg shrink-0">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span className="text-xs font-bold text-amber-600">4.8</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {['观箭海景房', '含双早', '免费停车', '发射观礼接送'].map(t => (
                        <span key={t} className="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                    <div className="flex items-baseline justify-between mt-3">
                      <div className="text-xs text-gray-400">有问题直接问我，秒回～</div>
                      <div className="text-right">
                        <span className="text-red-500 font-extrabold text-xl">¥328</span>
                        <span className="text-xs text-gray-400"> 起/晚</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {hotel.messages.length === 0 && (
                <div className="px-4 pt-4">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                    <h2 className="text-base font-bold text-gray-800 mb-2">大家常问</h2>
                    <ul className="text-sm rounded-xl overflow-hidden border border-gray-100">
                      {hotelSuggestedQuestions.map((q, idx) => (
                        <li
                          key={idx}
                          className="flex text-gray-800 py-2.5 border-b border-gray-100 last:border-0 hover:bg-blue-50/50 cursor-pointer transition-colors px-3"
                          onClick={() => hotel.send(q)}
                        >
                          <span className="w-6 text-blue-600/80 font-mono font-medium">{idx + 1}</span>
                          <span className="flex-1 font-medium">{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              <MessageList messages={hotel.messages} isGenerating={hotel.isGenerating} />
            </div>

            <ChatInput
              value={hotelInput}
              onChange={setHotelInput}
              onSend={() => { const t = hotelInput; setHotelInput(''); hotel.send(t); }}
              disabled={hotel.isGenerating}
              placeholder="咨询房态、房型、价格、周边玩法..."
            />
          </>
        )}

        {/* ================= 旅购商城 ================= */}
        {tab === 'mall' && (
          <>
            <div className="bg-white/95 backdrop-blur border-b border-gray-100 px-4 pt-5 pb-3 shrink-0 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h1 className="text-2xl font-extrabold text-gray-800">旅购商城</h1>
                  <div className="text-xs text-gray-400 mt-0.5">文昌供应链直供 · 产地好货</div>
                </div>
                <button className="relative p-2.5 bg-blue-50 rounded-full">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </button>
              </div>
              <div className="flex items-center space-x-2 bg-gray-100 rounded-full px-4 py-2.5">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索文昌鸡、椰子糖、航天文创..."
                  className="flex-1 bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400 min-w-0"
                />
              </div>
              {/* 分类 */}
              <div className="flex space-x-2 mt-3 overflow-x-auto pb-1 -mx-1 px-1">
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    onClick={() => setActiveCategory(c)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                      activeCategory === c
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white text-gray-600 border border-gray-200'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="grid grid-cols-2 gap-3 pb-2">
                {filteredProducts.map(p => (
                  <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                    <div className={`h-28 bg-gradient-to-br ${p.gradient} flex items-center justify-center text-5xl relative`}>
                      {p.emoji}
                      <span className="absolute top-2 left-2 bg-white/90 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {p.tag}
                      </span>
                    </div>
                    <div className="p-3 flex-1 flex flex-col">
                      <div className="text-[13px] font-bold text-gray-800 leading-snug">{p.name}</div>
                      <div className="text-[11px] text-gray-400 mt-1">{p.sales}</div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-red-500 font-extrabold text-lg">
                          ¥{p.price}
                        </div>
                        <button
                          onClick={() => addToCart(p.name)}
                          className="w-7 h-7 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition-colors active:scale-90"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Toast */}
            {toast && (
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-gray-800/90 text-white text-xs px-4 py-2.5 rounded-full shadow-lg z-50 whitespace-nowrap">
                {toast}
              </div>
            )}
          </>
        )}

        {/* ================= 底部 Tab 栏 ================= */}
        {showTabBar && (
          <div className="bg-white border-t border-gray-100 px-10 py-2.5 flex justify-between items-center shrink-0">
            <button
              onClick={() => { setTab('home'); setHomeView('landing'); }}
              className={`flex flex-col items-center space-y-0.5 transition-colors ${tab === 'home' ? 'text-blue-600' : 'text-gray-400'}`}
            >
              <Home className="w-6 h-6" />
              <span className="text-[11px] font-bold">首页</span>
            </button>
            <button
              onClick={() => setTab('mall')}
              className={`flex flex-col items-center space-y-0.5 transition-colors ${tab === 'mall' ? 'text-blue-600' : 'text-gray-400'}`}
            >
              <ShoppingBag className="w-6 h-6" />
              <span className="text-[11px] font-bold">旅购</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
