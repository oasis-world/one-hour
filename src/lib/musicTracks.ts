/**
 * Background music track lists for the one-hour chat room.
 *
 * All sources are freely licensed (CC-BY / public domain) audio hosted on
 * Wikimedia Commons. Each entry is a direct, browser-playable media URL.
 *
 *  - zh: Chinese traditional / folk classics
 *  - en: ambient + production music (Kevin MacLeod, Scott Buckley, Audionautix)
 *        + CC pop/rock (Josh Woodward) + a few public-domain country songs
 */
export const MUSIC_TRACKS: Record<string, string[]> = {
  zh: [
    // Chinese traditional / folk (public domain or CC)
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/f/ff/%E4%BA%8C%E6%B3%89%E6%98%A0%E6%9C%88.ogg/%E4%BA%8C%E6%B3%89%E6%98%A0%E6%9C%88.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/6/60/Guqin-Yangguan_Sandie.ogg/Guqin-Yangguan_Sandie.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/1/16/Qiu_Feng_Ci.ogg/Qiu_Feng_Ci.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/e/ed/Kuai_le_de_qia_qia_gu_niang_-_Teresa_Teng_-_Deng_Lijun_%28%E5%BF%AB%E4%B9%90%E7%9A%84%E6%81%B0%E6%81%B0%E5%A7%91%E5%A8%98%29.opus/Kuai_le_de_qia_qia_gu_niang_-_Teresa_Teng_-_Deng_Lijun_%28%E5%BF%AB%E4%B9%90%E7%9A%84%E6%81%B0%E6%81%B0%E5%A7%91%E5%A8%98%29.opus.mp3',
    // Guqin classics (public domain performances on Wikimedia Commons)
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/5/52/Guqin-Zuiyu_Changwan.ogg/Guqin-Zuiyu_Changwan.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/8/8f/Jiu_Kuang.ogg/Jiu_Kuang.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e0/Liu_Shui.ogg/Liu_Shui.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/5/5a/Pingsha_Luoyan.ogg/Pingsha_Luoyan.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/1/1e/Shenren_Chang.ogg/Shenren_Chang.ogg.mp3',
    // Erhu & Cantonese classics + Kevin MacLeod's Chinese-flavored pieces
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/3/30/%E6%B1%9F%E6%B2%B3%E6%B0%B4.ogg/%E6%B1%9F%E6%B2%B3%E6%B0%B4.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/1/1d/%E8%BF%9E%E7%8E%AF%E6%89%A3.ogg/%E8%BF%9E%E7%8E%AF%E6%89%A3.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/f/f3/%E9%9B%A8%E6%89%93%E8%8A%AD%E8%95%89.ogg/%E9%9B%A8%E6%89%93%E8%8A%AD%E8%95%89.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/6/6d/Tea_Roots_%28MacLeod%2C_Kevin%29_%28ISRC_USUAN1100472%29.oga/Tea_Roots_%28MacLeod%2C_Kevin%29_%28ISRC_USUAN1100472%29.oga.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/5/5c/Shenyang_%28ISRC_USUAN1600066%29.mp3',
  ],
  en: [
    // Ambient / background
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/5/52/Uniq_-_Art_Of_Silence_V2.ogg/Uniq_-_Art_Of_Silence_V2.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/8/8e/Scott_Buckley_-_Aurora.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/3/31/SoundAudio_-_Forest_%28relaxing_music%29.opus/SoundAudio_-_Forest_%28relaxing_music%29.opus.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/3/3e/Alex-Productions_-_Deep_%28Dark_Ambient_Background_music%29.oga/Alex-Productions_-_Deep_%28Dark_Ambient_Background_music%29.oga.mp3',
    // Kevin MacLeod (CC-BY 3.0, incompetech.com) — calm / soundtrack picks
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/6/67/Kevin_MacLeod_-_01_-_Meditation_Impromptu_01.ogg/Kevin_MacLeod_-_01_-_Meditation_Impromptu_01.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/5/59/Kevin_MacLeod_-_Autumn_Day.ogg/Kevin_MacLeod_-_Autumn_Day.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/5/58/Kevin_MacLeod_-_Carefree.ogg/Kevin_MacLeod_-_Carefree.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/4/4c/Kevin_MacLeod_-_Cattails.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/8/80/MacLeod%2C_Kevin_-_Snowdrop.ogg/MacLeod%2C_Kevin_-_Snowdrop.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/9/9c/Heart_of_Nowhere_%28MacLeod%2C_Kevin%29_%28ISRC_USUAN1400045%29.oga/Heart_of_Nowhere_%28MacLeod%2C_Kevin%29_%28ISRC_USUAN1400045%29.oga.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/4/48/Peaceful_Desolation_%28Kevin_MacLeod%29_%28ISRC_USUAN1200017%29.oga/Peaceful_Desolation_%28Kevin_MacLeod%29_%28ISRC_USUAN1200017%29.oga.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/4/45/Kevin_MacLeod_-_The_Endless.ogg/Kevin_MacLeod_-_The_Endless.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/5/5a/Blue_Feather_%28ISRC_USUAN1100524%29.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/f/f1/Himalayan_Atmosphere_%28MacLeod%2C_Kevin%29_%28ISRC_USUAN1100204%29.oga/Himalayan_Atmosphere_%28MacLeod%2C_Kevin%29_%28ISRC_USUAN1100204%29.oga.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/2/21/Relaxing_Piano_Music_%28ISRC_USUAN1500075%29.mp3',
    // Scott Buckley (CC-BY 4.0, scottbuckley.com.au) — calm cinematic picks
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/f/f8/Scott_Buckley_-_Sleep.oga/Scott_Buckley_-_Sleep.oga.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/3/35/Scott_Buckley_-_In_Dreams.oga/Scott_Buckley_-_In_Dreams.oga.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/b/b7/Scott_Buckley_-_Affirmations.oga/Scott_Buckley_-_Affirmations.oga.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e5/Scott_Buckley_-_Chasing_Daylight.oga/Scott_Buckley_-_Chasing_Daylight.oga.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/1/16/Scott_Buckley_-_This_Too_Shall_Pass.oga/Scott_Buckley_-_This_Too_Shall_Pass.oga.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/c/c2/Scott_Buckley_-_Hymn.mp3',
    // Country / English songs (public domain)
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/3/3b/Media.io_1-01_Walkin%27_After_Midnight.ogg/Media.io_1-01_Walkin%27_After_Midnight.ogg.mp3',
    "https://upload.wikimedia.org/wikipedia/commons/transcoded/9/92/George_Jones_sings_%27I%27m_Ragged_But_I%27m_Right%27.oga/George_Jones_sings_%27I%27m_Ragged_But_I%27m_Right%27.oga.mp3",
    "https://upload.wikimedia.org/wikipedia/commons/transcoded/b/b8/Don%27tLetYourDealGoDown2.ogg/Don%27tLetYourDealGoDown2.ogg.mp3",
    // Audionautix (Jason Shaw, CC-BY 4.0) — instrumental production music, varied genres
    'https://upload.wikimedia.org/wikipedia/commons/b/b5/Audionautix-com-ccby-bebop25.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/6/62/Audionautix-com-ccby-boogiewoogiebed.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/b/bd/Audionautix-com-ccby-closertojazz.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/9/9a/Audionautix-com-ccby-datgroovefulltrack.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/7/71/Audionautix-com-ccby-jumpinboogiewoogie.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/d/d2/Audionautix-com-ccby-lineoffire.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/f/f4/Audionautix-com-ccby-mediumrock.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/c/c9/Audionautix-com-ccby-oceanfloor.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/b/b7/Audionautix-com-ccby-panamahat.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/7/75/Audionautix-com-ccby-popmetal.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/1/19/Audionautix-com-ccby-radiorock.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/1/1e/Audionautix-com-ccby-redwoodtrail.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/8/83/Audionautix-com-ccby-sidewayssamba.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/3/39/Audionautix-com-ccby-smoothjazznight.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/4/49/Audionautix-com-ccby-smoothsailingfulltrack.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/4/43/Audionautix-com-ccby-standardjazzbars.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/4/43/Audionautix-com-ccby-words.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/d/d7/Audionautix-com-ccby-yeahyeah.mp3',
    // Josh Woodward (CC-BY, pop/rock) — "Addressed to the Stars" album, vocal tracks
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/0/0c/Josh_Woodward_-_01_-_Release.ogg/Josh_Woodward_-_01_-_Release.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/a/a6/Josh_Woodward_-_03_-_Knock.ogg/Josh_Woodward_-_03_-_Knock.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/9/91/Josh_Woodward_-_05_-_After_the_Flames.ogg/Josh_Woodward_-_05_-_After_the_Flames.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/8/81/Josh_Woodward_-_07_-_My_Favorite_Regret.ogg/Josh_Woodward_-_07_-_My_Favorite_Regret.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/6/68/Josh_Woodward_-_09_-_Perfect.ogg/Josh_Woodward_-_09_-_Perfect.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/0/09/Josh_Woodward_-_11_-_The_Nest.ogg/Josh_Woodward_-_11_-_The_Nest.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/0/0e/Josh_Woodward_-_13_-_Words_Fall_Apart.ogg/Josh_Woodward_-_13_-_Words_Fall_Apart.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/4/40/Josh_Woodward_-_15_-_With_a_Whimper.ogg/Josh_Woodward_-_15_-_With_a_Whimper.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/4/4e/Josh_Woodward_-_17_-_Bloom.ogg/Josh_Woodward_-_17_-_Bloom.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/2/2c/Josh_Woodward_-_19_-_Too_Many_Valleys.ogg/Josh_Woodward_-_19_-_Too_Many_Valleys.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/b/b2/Josh_Woodward_-_21_-_Aimless.ogg/Josh_Woodward_-_21_-_Aimless.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/3/39/Josh_Woodward_-_23_-_Princess.ogg/Josh_Woodward_-_23_-_Princess.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/4/4a/Josh_Woodward_-_25_-_Orbit.ogg/Josh_Woodward_-_25_-_Orbit.ogg.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/3/33/Josh_Woodward_-_27_-_Show_Me.ogg/Josh_Woodward_-_27_-_Show_Me.ogg.mp3',
  ],

  light: [
    // Light / ambient pieces from Wikimedia Commons
    'https://upload.wikimedia.org/wikipedia/commons/e/ed/Dewdrop_Fantasy_%28ISRC_USUAN1700001%29.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/3/36/SolusLunes_-_Solus-_Endless_Space_%28cc-by-3.0%29.mp3',
  ],
}