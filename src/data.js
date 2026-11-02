export const CATEGORIES = ['旅行', '城市', '自然', '日常', '人像', '创作', '待分类'];
const records = [
  [1015,'峡湾的午后','旅行','2026-10-24'],
  [1043,'山间的宁静','自然','2026-10-24'],
  [1067,'城市的金色时刻','城市','2026-10-20'],
  [1060,'一杯好咖啡','日常','2026-10-18'],
  [1076,'建筑的线条','城市','2026-10-15'],
  [1018,'通往远方','旅行','2026-10-12'],
  [1035,'瀑布与彩虹','自然','2026-10-12'],
  [1005,'海风与她','人像','2026-10-10'],
  [1016,'暮色中的山谷','旅行','2026-10-08'],
  [1011,'湖上的片刻','人像','2026-10-08'],
  [1040,'森林里的城堡','旅行','2026-10-06'],
  [1025,'披着毯子的小伙伴','日常','2026-10-04'],
];
export const SEED_PHOTOS = records.map(([id,name,category,date]) => ({id:String(id),name,category,demoCategory:category,date,src:`/photos/${id}.jpg`,style:'original',favorite:[1015,1011,1060].includes(id),kind:'photo'}));
export const UPLOAD_SAMPLES = [[20,'桌边的日常','日常'],[1036,'雪山来信','自然'],[1080,'甜甜的下午','日常'],[1084,'海边的小伙伴','自然']];
export const SEED_ALBUMS = [
  {id:'water',title:'远山与水',note:'想把这些安静的片刻，收进同一页。',photoIds:['1015','1043','1011']},
  {id:'city',title:'城市片段',note:'抬头看见的线条，和一杯咖啡。',photoIds:['1067','1076','1060']},
];
export const STYLES = [
 {id:'original',name:'原片',subtitle:'保留当时的光',filter:'none',tone:'#e9eef3'},
 {id:'film',name:'胶片暖调',subtitle:'暖色、柔和、慢一点',filter:'sepia(.28) saturate(.86) contrast(.94) brightness(1.05)',tone:'#d4ba93'},
 {id:'mono',name:'黑白叙事',subtitle:'让光影成为主角',filter:'grayscale(1) contrast(1.16) brightness(1.03)',tone:'#6c7279'},
 {id:'soft',name:'柔彩绘本',subtitle:'低对比与色块示意',filter:'saturate(.75) contrast(.84) brightness(1.12)',tone:'#a7c2b4'},
];
export const styleFor = id => STYLES.find(s=>s.id===id)||STYLES[0];
export const photoSrc = photo => photo.renderedSrc || photo.src;
export function freshState(){return {photos:SEED_PHOTOS,albums:SEED_ALBUMS};}
