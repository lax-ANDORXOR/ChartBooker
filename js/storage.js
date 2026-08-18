const STORAGE_KEY = 'chartbooker_profile';

function loadProfile() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : { name: '', avatar: '' };
    } catch { return { name: '', avatar: '' }; }
}

function saveProfile(name, avatar) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, avatar }));
    } catch {}
}

function randomName() {
    const cn = '王李张刘陈杨赵黄周吴徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾萧田董潘袁蔡蒋余于杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤';
    const en = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const useCN = Math.random() < 0.5;
    let name = '';
    if (useCN) {
        const len = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < len; i++) name += cn[Math.floor(Math.random() * cn.length)];
    } else {
        const len = 3 + Math.floor(Math.random() * 5);
        for (let i = 0; i < len; i++) name += en[Math.floor(Math.random() * en.length)];
    }
    document.getElementById('playerNameInput').value = name;
    playerName = name;
    saveProfile(name, playerAvatar);
}