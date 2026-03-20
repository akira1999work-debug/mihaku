/**
 * 日替わりの一言 — 問いかけ・気づき
 *
 * 幸福の科学の一転語のエッセンスをmihakuの哲学に変換。
 * 宗教的表現は使わない。評価・命令もしない。
 *
 * カテゴリ付きで管理し、将来的にユーザーの行動パターンに
 * 応じてカテゴリの出現率を調整する（v2 パーソナライズ）。
 *
 * カテゴリ:
 *   choice    — 心の選択・自己信頼
 *   reflect   — 内省・心の浄化
 *   reframe   — 光転（逆境のリフレーミング）
 *   gratitude — 感謝・今ここ
 *   pace      — 自分のペース
 *   connect   — 与える・つながり
 *   margin    — 選択と余白（mihakuコア）
 *   drive     — 前進・常勝（仕事系ユーザー向け）
 */

export type WordCategory =
  | 'choice' | 'reflect' | 'reframe' | 'gratitude'
  | 'pace' | 'connect' | 'margin' | 'drive';

export interface DailyWordEntry {
  text: string;
  category: WordCategory;
}

export const dailyWords: DailyWordEntry[] = [

  // ── choice: 心の選択・自己信頼 ──
  { text: '今日をどう過ごすか、選べるのは自分だけ', category: 'choice' },
  { text: '心がざわつく時、何に反応しているか気づいてる？', category: 'choice' },
  { text: '自分を信じるって、完璧でいることじゃない', category: 'choice' },
  { text: '迷う時間も、自分と向き合ってる時間', category: 'choice' },
  { text: '「どうすべきか」より「どうありたいか」', category: 'choice' },
  { text: '思いの方向を変えるだけで、同じ1日が違って見える', category: 'choice' },
  { text: '不安は、自分を大切にしたい気持ちの裏返しかもしれない', category: 'choice' },

  // ── reflect: 内省・心の浄化 ──
  { text: '今日の自分に正直でいられた？', category: 'reflect' },
  { text: '立ち止まって振り返る時間は、無駄じゃなくて投資', category: 'reflect' },
  { text: '心が重い時は、抱えすぎてるサイン', category: 'reflect' },
  { text: '昨日の後悔は、今日の自分が成長した証', category: 'reflect' },
  { text: '自分の気持ちに嘘をつかなくていい日にしよう', category: 'reflect' },
  { text: '「なぜこれをやるのか」、最後にいつ自分に聞いた？', category: 'reflect' },

  // ── reframe: 光転（逆境のリフレーミング）──
  { text: '手放すことは、失うことじゃなくて選ぶこと', category: 'reframe' },
  { text: 'うまくいかなかった日にも、気づきは隠れてる', category: 'reframe' },
  { text: '計画通りにいかない時こそ、本当に大事なものが見える', category: 'reframe' },
  { text: '「できなかった」の中に、次の一歩のヒントがある', category: 'reframe' },
  { text: '予定が崩れた日は、自分の本音が出やすい日', category: 'reframe' },
  { text: '思い通りにならないことが、思いもよらない場所に連れていく', category: 'reframe' },

  // ── gratitude: 感謝・今ここ ──
  { text: '今日、ありがとうと思えたことはある？', category: 'gratitude' },
  { text: '当たり前の日常の中に、守りたいものがある', category: 'gratitude' },
  { text: '小さな「よかった」に気づけた日は、いい日', category: 'gratitude' },
  { text: '誰かの優しさに気づけるのは、心に余裕がある証拠', category: 'gratitude' },
  { text: '何気ない時間の中にある温かさ、見落としてないですか？', category: 'gratitude' },

  // ── pace: 自分のペース ──
  { text: '人生は短距離走じゃない。今日の1歩でいい', category: 'pace' },
  { text: '焦りは、自分のペースを見失ったサイン', category: 'pace' },
  { text: '速さを競わなくていい。方向が合ってればいい', category: 'pace' },
  { text: '今日やれなくても、明日がある。それだけのこと', category: 'pace' },
  { text: '周りと違うペースで進んでも、ちゃんと前に進んでる', category: 'pace' },
  { text: '息切れしたら、走り方を変える時かもしれない', category: 'pace' },

  // ── connect: 与える・つながり ──
  { text: '自分に優しくできた日は、人にも優しくできる', category: 'connect' },
  { text: '誰かのためにしたことが、自分を軽くすることもある', category: 'connect' },
  { text: '「助けて」と言えるのも、強さの一つ', category: 'connect' },

  // ── margin: 選択と余白（mihakuコア）──
  { text: '「やらなきゃ」の中に、本当にやりたいことはいくつある？', category: 'margin' },
  { text: '今日、自分のために守りたい時間はありますか？', category: 'margin' },
  { text: 'もし今日3つしかできないなら、何を残す？', category: 'margin' },
  { text: '誰かの期待と、自分の本音。今日はどっちを選ぶ？', category: 'margin' },
  { text: '忙しいのは事実。でもそれ、自分で選んだ忙しさ？', category: 'margin' },
  { text: '「やるべき」を外したら、何が残る？', category: 'margin' },
  { text: '3つ選ぶことは、残りを手放すこと', category: 'margin' },
  { text: '余白は怠けじゃない。余白は選択', category: 'margin' },
  { text: '全部やらなくていい。全部やれなくていい', category: 'margin' },
  { text: '自分で選んだ3つは、誰かに決められた10個より強い', category: 'margin' },
  { text: '手放した数だけ、自分の輪郭がはっきりする', category: 'margin' },
  { text: '休むことに理由はいらない', category: 'margin' },
  { text: 'やることを減らすと、1つ1つが濃くなる', category: 'margin' },
  { text: '今日も、自分で選んだ1日にできる', category: 'margin' },
  { text: '比べなくていい日があってもいい', category: 'margin' },
  { text: '「まだ足りない」は誰の声だろう', category: 'margin' },
  { text: '完璧な1日より、自分らしい1日', category: 'margin' },
  { text: '何もしなかった日も、ちゃんと生きた1日', category: 'margin' },
  { text: '誰かの正解は、あなたの正解じゃないかもしれない', category: 'margin' },
  { text: '立ち止まることと、諦めることは全然違う', category: 'margin' },
  { text: '今日の選択に、正解も不正解もない', category: 'margin' },

  // ── drive: 前進・常勝（仕事系ユーザー向け）──
  // 「常勝思考」「飛翔」のエッセンス。mihaku的に変換。
  { text: '壁にぶつかった時こそ、次の扉が近い', category: 'drive' },
  { text: '昨日の自分を超えるのに、誰の許可もいらない', category: 'drive' },
  { text: '今日やると決めたなら、迷わず手を動かす', category: 'drive' },
  { text: '小さな前進を積み重ねた先に、大きな景色がある', category: 'drive' },
  { text: '逆風の日ほど、自分の強さを知る日になる', category: 'drive' },
  { text: '失敗は結果じゃない。途中経過にすぎない', category: 'drive' },
  { text: '考えてから動くより、動きながら考える日があってもいい', category: 'drive' },
  { text: '「まだやれる」と思える自分を、信じていい', category: 'drive' },
  { text: '困難の数だけ、引き出しが増えている', category: 'drive' },
  { text: '今日の全力は、明日の自分への最高の贈り物', category: 'drive' },
  { text: '立ち上がる回数が、倒れた回数より1回多ければいい', category: 'drive' },
  { text: '限界は、自分が決めた線にすぎない', category: 'drive' },
];

/**
 * 日付ベースでその日の一言を返す
 *
 * v1: 全カテゴリからフラットに日替わり
 * v2: ユーザーの行動パターンに応じてカテゴリの出現率を調整
 *     - 仕事タスク多め・手放し率低い → drive の比率UP
 *     - 手放し率高い・余白重視 → margin, reflect 中心
 *     - 完了率低下・リスケ増加 → pace, gratitude 中心
 */
export function getDailyWord(date: Date = new Date()): string {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  return dailyWords[dayOfYear % dailyWords.length].text;
}
