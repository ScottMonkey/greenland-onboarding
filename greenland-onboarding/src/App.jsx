import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'; 
import { 
  UploadCloud, CheckCircle, ImageIcon, Lock, LogOut, Download, FileText, 
  User, CreditCard, GraduationCap, Briefcase, PhoneCall, HelpCircle, 
  MapPin, Globe, Plus, Trash2, ShieldCheck, Heart, Award 
} from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as docx from 'docx';

// --- 1. 配置與嵌入圖片 (Base64) ---
const ADMIN_PASSCODE = 'admin123';
const PRIVACY_STATEMENT = "本人了解並同意 Green Land (以下簡稱貴公司) 為辦理入職手續、薪資管理及人資管理之目的，得蒐集、處理及利用本人提供之上述個人資料。貴公司應依法採取安全保護措施，本人確保所填寫之資料均為屬實，如有虛假願負相關法律責任。";

// LOGO 直接鑲嵌
const LOGO_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAZAAAAEOCAYAAABv79X6AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAL3SURBVHgB7d0hbhRBFEDR9940ZpI9Ag6CwSBYDAbB4CHYDAKBICAgmAyCwXAQDI6CwSBY9AQCgeA0JpPdGZpX+at6vcl0V30f2mS6674PbbLreR9S6rnux9As8z6E1N91PwY32fV8PzS/1v0YXGvX8/3Q/Fr3Y3CtXc/3Q/Nr3Y/BtXY93w/Nr3U/Btf6tO7v0Pzs+p5Uqofup9Qs+z6E1N91PwY32fV8PzS/1v0YXGvX8/3Q/Fr3Y3CtXc/3Q/Nr3Y/BtXY93w/Nr3U/Btfade77/S8SAD77L3H77Y8EANz2e787EABw16fEAMB9EgMA90kMANwnMQBwn8QAwH0SAwD3SQwA3CcxAHCfxADAfRIDADd9fkgMAHx5fD8kBgA+v/p6v9+3e2v9zGv9/L01f+Z1H0Lqz7ofg5vser4fml/rfgz6X8+S6rnux+Amu57vh+bXuh+Da+16vh+aX+t+DK616/l+aH6t+zG41q7n+6H5te7H4Fq7zv2mR6lZ9n0Iqb/rfgxusuuT6S6lnutuXveD6637MbT7p8SklHqu+zG0y7oPQ+qvuh+D+u6vX6pU8zq5Xut+DKr1671Sre/7MbvWfUipp973Y2iXdT+GdvvjPof0V73vx5D68z6H9Fe978eQ+vM+h/RXve/HkPrzPof0V73vx5D6677f/wEB4LP/E7ff/kgAwG0SAwD3SQwA3CcxAHCfxADAfRIDADdJDADcJzEAcJ/EAMB9EgMA90kMANwnMQBwn+8SAwD36XNCAuA2SQyA2yQxAG6TxAC4TRID4DZJDIDbJDEAbpPEALhNEgPgNkkMgNskMQBuk8QAuE0SA+A2SQyA2yQxAG6TxAC4TRID4DZJDIDbJDEAbvM5IQFw26fEAMBtkhiAz7+fEpNS6rnux6B+/QIAAP//BId9H/vD/0QAAAAASUVORK5CYII=";

const firebaseConfig = {
  apiKey: "AIzaSyCUp5g6lSRTe4g83k0tBYMczO8Fy2ESh24",
  authDomain: "gen-lang-client-0846983895.firebaseapp.com",
  projectId: "gen-lang-client-0846983895",
  storageBucket: "gen-lang-client-0846983895.firebasestorage.app",
  messagingSenderId: "467882980488",
  appId: "1:467882980488:web:e72a28b48cd9304ac01b3d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const appId = 'green-land-app';

// --- 2. 工具函數 ---
const base64ToBuffer = (str) => Uint8Array.from(atob(str), c => c.charCodeAt(0));

const getBase64FromUrl = async (url) => {
  if (!url || url.includes('.pdf')) return null;
  try {
    const data = await fetch(url);
    const blob = await data.blob();
    return new Promise((r) => { const reader = new FileReader(); reader.readAsArrayBuffer(blob); reader.onloadend = () => r(reader.result); });
  } catch (e) { return null; }
};

const resizeImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
        else { if (h > MAX) { w *= MAX / h; h = MAX; } }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    };
  });
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('form'); 
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '' });
  const [submissions, setSubmissions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  // --- 完整欄位定義 ---
  const [formData, setFormData] = useState({
    onboardingDate: '', name: '', englishName: '', idNumber: '', dob: '', gender: '', bloodType: '', nationality: '', maritalStatus: '',
    phone: '', homePhone: '', email: '', lineId: '', wechatId: '', registeredAddress: '', currentAddress: '',
    educationLevel: '', schoolName: '', major: '', graduationStatus: '',
    lastCompany: '', lastJobTitle: '', workYears: '', lastJobContent: '', skills: '',
    emergency1_name: '', emergency1_relation: '', emergency1_phone: '',
    emergency2_name: '', emergency2_relation: '', emergency2_phone: '',
    languages: [{ lang: '中文', listen: '精通', speak: '精通', read: '精通', write: '精通' }],
    familyMembers: [
      { name: '', relation: '', phone: '' }, { name: '', relation: '', phone: '' },
      { name: '', relation: '', phone: '' }, { name: '', relation: '', phone: '' }
    ],
    noBankAccount: false,
    profilePic: '', idCardFront: '', idCardBack: '', passportPic: '', twdAccountPic: '', foreignAccountPic: ''
  });

  useEffect(() => { onAuthStateChanged(auth, (u) => { if (!u) signInAnonymously(auth); setUser(u); }); }, []);

  useEffect(() => {
    if (user && view === 'form') {
      const fetchMyData = async () => {
        setLoading(true);
        try {
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'onboarding_submissions', user.uid);
          const snap = await getDoc(docRef);
          if (snap.exists()) setFormData(prev => ({ ...prev, ...snap.data(), languages: snap.data().languages || prev.languages, familyMembers: snap.data().familyMembers || prev.familyMembers }));
        } catch (e) { console.error(e); }
        setLoading(false);
      };
      fetchMyData();
    }
  }, [user, view]);

  useEffect(() => {
    if (user && view === 'admin_dashboard') {
      const ref = collection(db, 'artifacts', appId, 'public', 'data', 'onboarding_submissions');
      return onSnapshot(ref, (s) => setSubmissions(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.submittedAt || 0) - (a.submittedAt || 0))));
    }
  }, [user, view]);

  // --- Word 生成：修正排版與 Logo ---
  const generateWordDoc = async (data) => {
    const logoBuffer = base64ToBuffer(LOGO_BASE64);
    const profileBuffer = data.profilePic ? await getBase64FromUrl(data.profilePic) : null;
    const fillDate = data.submittedAt ? new Date(data.submittedAt).toLocaleDateString() : new Date().toLocaleDateString();

    const FONT = "微軟正黑體";
    const L_BG = "F2F2F2";
    const S_BG = "166534";

    const createLabel = (text) => new docx.TableCell({
      children: [new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, children: [new docx.TextRun({ text, bold: true, size: 18, font: FONT })] })],
      shading: { fill: L_BG },
      verticalAlign: docx.VerticalAlign.CENTER,
    });

    const createValue = (text, colSpan = 1) => new docx.TableCell({
      children: [new docx.Paragraph({ children: [new docx.TextRun({ text: text || "-", size: 20, font: FONT })] })],
      columnSpan: colSpan,
      verticalAlign: docx.VerticalAlign.CENTER,
    });

    const createHeader = (text) => new docx.TableRow({
      children: [new docx.TableCell({
        columnSpan: 5, shading: { fill: S_BG },
        children: [new docx.Paragraph({ children: [new docx.TextRun({ text, bold: true, color: "FFFFFF", size: 20, font: FONT })] })],
      })],
    });

    const docObj = new docx.Document({
      sections: [{
        properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        headers: {
          default: new docx.Header({
            children: [
              new docx.Paragraph({
                children: [
                  new docx.ImageRun({
                    data: logoBuffer,
                    transformation: { width: 152, height: 72 },
                    floating: { horizontalPosition: { offset: 457200 }, verticalPosition: { offset: 457200 } },
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new docx.Paragraph({ alignment: docx.AlignmentType.RIGHT, children: [new docx.TextRun({ text: `填寫日期：${fillDate}`, size: 18, font: FONT })] }),
          new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, children: [new docx.TextRun({ text: "員工入職基本資料表", bold: true, size: 36, font: FONT })] }),
          new docx.Paragraph(""),
          new docx.Table({
            width: { size: 100, type: docx.WidthType.PERCENTAGE },
            rows: [
              createHeader("一、 個人基本資料"),
              new docx.TableRow({
                children: [
                  new docx.TableCell({
                    rowSpan: 4, width: { size: 20, type: docx.WidthType.PERCENTAGE },
                    children: [ profileBuffer ? new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, children: [new docx.ImageRun({ data: profileBuffer, transformation: { width: 100, height: 125 } })] }) : new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, children: [new docx.TextRun({ text: "貼照片處", size: 16, font: FONT })] }) ],
                    verticalAlign: docx.VerticalAlign.CENTER,
                  }),
                  createLabel("中文姓名"), createValue(data.name),
                  createLabel("英文姓名"), createValue(data.englishName),
                ],
              }),
              new docx.TableRow({ children: [ createLabel("身分證號"), createValue(data.idNumber), createLabel("入職日期"), createValue(data.onboardingDate) ] }),
              new docx.TableRow({ children: [ createLabel("國籍/血型"), createValue(`${data.nationality || '-'} / ${data.bloodType || '-'}`), createLabel("性別/婚姻"), createValue(`${data.gender || '-'} / ${data.maritalStatus || '-'}`) ] }),
              new docx.TableRow({ children: [ createLabel("出生日期"), createValue(data.dob), createLabel("手機號碼"), createValue(data.phone) ] }),
              new docx.TableRow({ children: [ createLabel("戶籍地址"), createValue(data.registeredAddress, 4) ] }),
              new docx.TableRow({ children: [ createLabel("通訊地址"), createValue(data.currentAddress, 4) ] }),
              createHeader("二、 家庭成員"),
              ...(data.familyMembers || []).map(f => new docx.TableRow({ children: [ createLabel(f.relation || "成員"), createValue(f.name, 2), createLabel("電話"), createValue(f.phone) ] })),
              createHeader("三、 學經歷與工作技能"),
              new docx.TableRow({ children: [ createLabel("最高學歷"), createValue(`${data.educationLevel} - ${data.schoolName}`, 2), createLabel("畢業狀態"), createValue(data.graduationStatus) ] }),
              new docx.TableRow({ children: [ createLabel("前職公司"), createValue(data.lastCompany, 2), createLabel("前職/年資"), createValue(`${data.lastJobTitle} / ${data.workYears}年`) ] }),
              new docx.TableRow({ children: [ createLabel("工作內容"), createValue(data.lastJobContent, 4) ] }),
              new docx.TableRow({ children: [ createLabel("專業技能"), createValue(data.skills, 4) ] }),
              createHeader("四、 語言能力"),
              ...(data.languages || []).map(l => new docx.TableRow({ children: [ createLabel(l.lang), createValue(`聽:${l.listen} 說:${l.speak} 讀:${l.read} 寫:${l.write}`, 4) ] })),
              createHeader("五、 緊急聯絡資訊"),
              new docx.TableRow({ children: [ createLabel("第一聯絡人"), createValue(data.emergency1_name), createLabel("關係/電話"), createValue(`${data.emergency1_relation} / ${data.emergency1_phone}`, 2) ] }),
              new docx.TableRow({ children: [ createLabel("第二聯絡人"), createValue(data.emergency2_name), createLabel("關係/電話"), createValue(`${data.emergency2_relation} / ${data.emergency2_phone}`, 2) ] }),
            ]
          }),
          new docx.Paragraph(""),
          new docx.Paragraph({ children: [new docx.TextRun({ text: PRIVACY_STATEMENT, size: 18, font: FONT, color: "666666" })] }),
        ],
      }],
    });
    return await docx.Packer.toBlob(docObj);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const downloadBatchZip = async () => {
    if (selectedIds.length === 0) return alert("請勾選人員");
    setLoading(true);
    const zip = new JSZip();
    const selected = submissions.filter(s => selectedIds.includes(s.id));
    for (const p of selected) {
      const folder = zip.folder(p.name || '未命名');
      folder.file(`入職表_${p.name}.docx`, await generateWordDoc(p));
      const files = ['profilePic', 'idCardFront', 'idCardBack', 'passportPic', 'twdAccountPic', 'foreignAccountPic'];
      for(let f of files) {
        if(p[f] && p[f].startsWith('http')) {
          const res = await fetch(p[f]);
          const blob = await res.blob();
          const ext = blob.type.includes('pdf') ? 'pdf' : 'jpg';
          folder.file(`${f}.${ext}`, blob);
        }
      }
    }
    saveAs(await zip.generateAsync({type:"blob"}), "GreenLand_員工入職包.zip");
    setLoading(false);
  };

  const executeSubmit = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'onboarding_submissions', user.uid);
      await setDoc(docRef, { ...formData, submittedAt: Date.now(), updatedAt: Date.now() });
      setShowConfirmModal(false);
      setNotification({ show: true, message: "提交成功！" });
      setTimeout(() => setNotification({ show: false }), 3000);
    } catch (e) { alert("儲存失敗"); }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-[#F9FBFA] text-gray-800 p-4 font-sans text-sm">
      {notification.show && <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-green-800 text-white px-8 py-3 rounded-full shadow-2xl font-bold">{notification.message}</div>}

      <header className="max-w-6xl mx-auto flex justify-between items-center h-24 px-8 bg-white rounded-3xl shadow-sm mb-8 border sticky top-4 z-40">
        <h1 className="text-2xl font-black text-green-900 tracking-tighter cursor-pointer" onClick={() => setView('form')}>GREEN LAND</h1>
        <button onClick={() => setView(view === 'form' ? 'admin_login' : 'form')} className="font-bold text-gray-400 hover:text-green-800 flex items-center gap-2">
          {view === 'form' ? <Lock size={18}/> : <LogOut size={18}/>} {view === 'form' ? '後台登入' : '返回'}
        </button>
      </header>

      <main className="max-w-5xl mx-auto pb-32">
        {!loading && view === 'form' && (
          <form onSubmit={(e) => { e.preventDefault(); setShowConfirmModal(true); }} className="space-y-10">
            {/* 1. 基本資料 */}
            <section className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border">
              <h3 className="text-2xl font-black mb-8 border-b-4 border-green-50 pb-4 text-green-900 flex items-center gap-3"><User /> 1. 個人詳細基本資料</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-400">入職日期 (選填)</label><input name="onboardingDate" type="date" value={formData.onboardingDate} onChange={handleInputChange} className="p-3 border rounded-xl" /></div>
                <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-400">中文姓名 *</label><input required name="name" value={formData.name} onChange={handleInputChange} className="p-3 border rounded-xl" /></div>
                <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-400">英文姓名</label><input name="englishName" value={formData.englishName} onChange={handleInputChange} className="p-3 border rounded-xl" /></div>
                <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-400">身分證號 *</label><input required name="idNumber" value={formData.idNumber} onChange={handleInputChange} className="p-3 border rounded-xl" /></div>
                <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-400">國籍</label><input name="nationality" value={formData.nationality} onChange={handleInputChange} className="p-3 border rounded-xl" /></div>
                <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-400">出生日期 *</label><input required name="dob" type="date" value={formData.dob} onChange={handleInputChange} className="p-3 border rounded-xl" /></div>
                <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-400">性別</label><select name="gender" value={formData.gender} onChange={handleInputChange} className="p-3 border rounded-xl bg-white"><option value="">選擇</option><option value="男">男</option><option value="女">女</option></select></div>
                <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-400">血型</label><input name="bloodType" value={formData.bloodType} onChange={handleInputChange} className="p-3 border rounded-xl" /></div>
                <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-400">婚姻</label><select name="maritalStatus" value={formData.maritalStatus} onChange={handleInputChange} className="p-3 border rounded-xl bg-white"><option value="">選擇</option><option value="未婚">未婚</option><option value="已婚">已婚</option></select></div>
                <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-400">手機號碼 *</label><input required name="phone" value={formData.phone} onChange={handleInputChange} className="p-3 border rounded-xl" /></div>
                <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-400">Email *</label><input required name="email" type="email" value={formData.email} onChange={handleInputChange} className="p-3 border rounded-xl" /></div>
                <div className="md:col-span-3 flex flex-col gap-1"><label className="text-xs font-bold text-gray-400">戶籍地址 *</label><input required name="registeredAddress" value={formData.registeredAddress} onChange={handleInputChange} className="p-3 border rounded-xl" /></div>
                <div className="md:col-span-3 flex flex-col gap-1"><label className="text-xs font-bold text-gray-400">通訊地址 *</label><input required name="currentAddress" value={formData.currentAddress} onChange={handleInputChange} className="p-3 border rounded-xl" /></div>
              </div>
            </section>

            {/* 2. 家庭成員 */}
            <section className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border">
              <h3 className="text-2xl font-black mb-8 border-b-4 border-green-50 pb-4 text-green-900 flex items-center gap-3"><Heart /> 2. 家庭成員資訊 (四位)</h3>
              {formData.familyMembers.map((f, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <input placeholder="關係" value={f.relation} onChange={(e) => {let n=[...formData.familyMembers]; n[i].relation=e.target.value; setFormData({...formData, familyMembers:n})}} className="p-2 border rounded-lg bg-white" />
                  <input placeholder="姓名" value={f.name} onChange={(e) => {let n=[...formData.familyMembers]; n[i].name=e.target.value; setFormData({...formData, familyMembers:n})}} className="p-2 border rounded-lg bg-white" />
                  <input placeholder="電話" value={f.phone} onChange={(e) => {let n=[...formData.familyMembers]; n[i].phone=e.target.value; setFormData({...formData, familyMembers:n})}} className="p-2 border rounded-lg bg-white" />
                </div>
              ))}
            </section>

            {/* 3. 學經歷與技能 */}
            <section className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border">
              <h3 className="text-2xl font-black mb-8 border-b-4 border-green-50 pb-4 text-green-900 flex items-center gap-3"><GraduationCap /> 3. 學經歷與工作技能</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <input placeholder="最高學歷 *" name="educationLevel" value={formData.educationLevel} onChange={handleInputChange} className="p-3 border rounded-xl" />
                <input placeholder="畢業學校 *" name="schoolName" value={formData.schoolName} onChange={handleInputChange} className="p-3 border rounded-xl" />
                <textarea placeholder="前公司工作內容" name="lastJobContent" value={formData.lastJobContent} onChange={handleInputChange} className="md:col-span-2 p-3 border rounded-xl h-24" />
                <textarea placeholder="專業技能與證照" name="skills" value={formData.skills} onChange={handleInputChange} className="md:col-span-2 p-3 border rounded-xl h-24" />
              </div>
            </section>

            {/* 4. 語言能力 (動態) */}
            <section className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border">
               <div className="flex justify-between items-center mb-8 border-b-4 border-green-50 pb-4">
                  <h3 className="text-2xl font-black text-green-900 flex items-center gap-3"><Globe /> 4. 語言能力評鑑</h3>
                  <button type="button" onClick={() => setFormData({...formData, languages: [...formData.languages, { lang: '', listen: '基礎', speak: '基礎', read: '基礎', write: '基礎' }]})} className="bg-green-50 text-green-700 px-4 py-2 rounded-xl text-xs font-bold">+ 新增語言</button>
               </div>
               {formData.languages.map((l, i) => (
                <div key={i} className="flex flex-wrap gap-4 items-end bg-gray-50 p-6 rounded-2xl mb-4 relative">
                  <button type="button" onClick={() => {let n=[...formData.languages]; n.splice(i,1); setFormData({...formData, languages:n})}} className="absolute top-2 right-2 text-red-300"><Trash2 size={16}/></button>
                  <input placeholder="語言" value={l.lang} onChange={(e) => {let n=[...formData.languages]; n[i].lang=e.target.value; setFormData({...formData, languages:n})}} className="p-2 border rounded-lg bg-white" />
                  {['listen', 'speak', 'read', 'write'].map(s => (
                    <div key={s} className="flex flex-col gap-1">
                       <span className="text-[10px] font-bold text-gray-400 uppercase">{s==='listen'?'聽':s==='speak'?'說':s==='read'?'讀':'寫'}能力</span>
                       <select value={l[s]} onChange={(e) => {let n=[...formData.languages]; n[i][s]=e.target.value; setFormData({...formData, languages:n})}} className="p-2 border rounded-lg bg-white text-xs"><option value="精通">精通</option><option value="中等">中等</option><option value="基礎">基礎</option></select>
                    </div>
                  ))}
                </div>
               ))}
            </section>

            {/* 5. 緊急聯絡人 */}
            <section className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border">
              <h3 className="text-2xl font-black mb-8 border-b-4 border-green-50 pb-4 text-green-900 flex items-center gap-3"><PhoneCall /> 5. 緊急聯絡資訊 (二位)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <input required placeholder="第一聯絡人姓名 *" name="emergency1_name" value={formData.emergency1_name} onChange={handleInputChange} className="p-3 border rounded-xl" />
                <input required placeholder="第一聯絡人關係 *" name="emergency1_relation" value={formData.emergency1_relation} onChange={handleInputChange} className="p-3 border rounded-xl" />
                <input required placeholder="第一聯絡人電話 *" name="emergency1_phone" value={formData.emergency1_phone} onChange={handleInputChange} className="p-3 border rounded-xl" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <input placeholder="第二聯絡人姓名" name="emergency2_name" value={formData.emergency2_name} onChange={handleInputChange} className="p-3 border rounded-xl" />
                <input placeholder="第二聯絡人關係" name="emergency2_relation" value={formData.emergency2_relation} onChange={handleInputChange} className="p-3 border rounded-xl" />
                <input placeholder="第二聯絡人電話" name="emergency2_phone" value={formData.emergency2_phone} onChange={handleInputChange} className="p-3 border rounded-xl" />
              </div>
            </section>

            {/* 6. 檔案上傳分流 (修復 PDF 顯示與免繳邏輯) */}
            <section className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border">
               <div className="flex justify-between items-center mb-8 border-b-4 border-green-50 pb-4 text-green-900">
                  <h3 className="text-2xl font-black flex items-center gap-3"><ShieldCheck /> 6. 檔案上傳與聲明</h3>
                  <label className="flex items-center gap-2 text-sm font-bold text-green-700 bg-green-50 px-4 py-2 rounded-xl cursor-pointer">
                    <input type="checkbox" name="noBankAccount" checked={formData.noBankAccount} onChange={handleInputChange} /> 免繳存摺
                  </label>
               </div>
               <div className="bg-green-50 p-6 rounded-2xl mb-8 text-sm font-bold border border-green-100 text-green-800 leading-relaxed">{PRIVACY_STATEMENT}</div>
               <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {['profilePic', 'idCardFront', 'idCardBack', 'passportPic', 'twdAccountPic', 'foreignAccountPic'].map(f => (
                    (!formData.noBankAccount || (f !== 'twdAccountPic' && f !== 'foreignAccountPic')) && (
                      <div key={f} className="relative border-2 border-dashed border-green-100 rounded-2xl h-48 flex flex-col items-center justify-center bg-white hover:bg-green-50 transition-all overflow-hidden p-4 text-center">
                        {formData[f] ? (
                          formData[f].includes('.pdf') ? <FileText size={48} className="text-red-500 mx-auto" /> : <img src={formData[f]} className="h-full w-full object-contain" />
                        ) : <Plus size={40} className="text-green-200 mx-auto" />}
                        <span className="mt-3 text-[10px] font-black text-green-800 uppercase">{f}</span>
                        <input type="file" accept="image/*,application/pdf" onChange={async (e) => {
                          const file = e.target.files[0]; if(!file) return; setLoading(true);
                          const sRef = ref(storage, `onboarding/${user.uid}/${f}`); await uploadBytes(sRef, file);
                          const url = await getDownloadURL(sRef); setFormData(p=>({...p, [f]:url})); setLoading(false);
                        }} className="absolute inset-0 opacity-0 cursor-pointer" />
                      </div>
                    )
                  ))}
               </div>
            </section>
            <button type="submit" className="w-full bg-green-900 text-white py-8 rounded-[3rem] font-black text-3xl shadow-2xl">確認提交申請</button>
          </form>
        )}

        {view === 'admin_login' && (
          <div className="max-w-md mx-auto bg-white p-12 rounded-[3rem] shadow-2xl text-center mt-10 border">
            <Lock className="mx-auto text-green-800 mb-6" size={64} />
            <form onSubmit={(e) => { e.preventDefault(); if(adminPassword === ADMIN_PASSCODE) setView('admin_dashboard'); else alert('錯誤'); }}>
              <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full p-4 border-2 rounded-2xl mb-6 text-xl font-bold text-center" placeholder="管理密碼" />
              <button type="submit" className="w-full bg-green-900 text-white py-4 rounded-2xl font-black">進入後台</button>
            </form>
          </div>
        )}

        {view === 'admin_dashboard' && (
          <div className="bg-white rounded-3xl shadow-sm border p-8">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black text-green-900">入職名單 ({submissions.length})</h2>
              <button onClick={downloadBatchZip} className="bg-green-800 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-lg"><Download size={20}/> 打包完整 ZIP</button>
            </div>
            <table className="w-full text-left text-sm border-collapse">
              <thead><tr className="bg-gray-50 font-black text-gray-400 uppercase"><th className="p-4 w-12 text-center"><input type="checkbox" onChange={(e) => setSelectedIds(e.target.checked ? submissions.map(s => s.id) : [])} /></th><th className="p-4">姓名</th><th className="p-4 text-right">檔案</th></tr></thead>
              <tbody className="divide-y">
                {submissions.map(s => (
                  <tr key={s.id} className={selectedIds.includes(s.id) ? 'bg-green-50' : ''}>
                    <td className="p-4 text-center"><input type="checkbox" checked={selectedIds.includes(s.id)} onChange={(e) => setSelectedIds(e.target.checked ? [...selectedIds, s.id] : selectedIds.filter(id => id !== s.id))} /></td>
                    <td className="p-4 font-black">{s.name}</td>
                    <td className="p-4 text-right flex justify-end gap-1">{s.profilePic && <div className="w-2 h-2 bg-green-500 rounded-full"></div>}{s.idCardFront && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-6 text-center">
          <div className="bg-white p-10 rounded-[3rem] max-w-sm w-full shadow-2xl">
            <h3 className="text-2xl font-black mb-4">確定提交？</h3>
            <div className="flex gap-4">
              <button onClick={() => setShowConfirmModal(false)} className="flex-1 bg-gray-100 py-4 rounded-2xl font-bold">返回</button>
              <button onClick={executeSubmit} className="flex-1 bg-green-800 text-white py-4 rounded-2xl font-bold">確認</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}