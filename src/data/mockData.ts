import type { DayOfWeek, Period, Term, Classroom, Subject } from '../types';

export const mockClassrooms: Classroom[] = [
    { id: "F-201", name: "F-201", building: "フォーサイト", capacity: 154, examCapacity: 98, type: "normal", isMovable: true, equipment: ["PJ(中)", "BD", "マイク", "黒板", "ブラインド"] },
    { id: "F-202", name: "F-202", building: "フォーサイト", capacity: 285, examCapacity: 165, type: "normal", isMovable: false, equipment: ["PJ(中)", "天井モニター", "BD", "マイク", "黒板", "ブラインド"] },
    { id: "F-203", name: "F-203", building: "フォーサイト", capacity: 120, examCapacity: 72, type: "normal", isMovable: false, equipment: ["PJ(中)", "BD", "マイク", "黒板", "ブラインド"] },
    { id: "F-301", name: "F-301", building: "フォーサイト", capacity: 128, examCapacity: 67, type: "normal", isMovable: true, equipment: ["PJ(中)", "BD", "マイク", "黒板", "白板", "ブラインド"] },
    { id: "F-302", name: "F-302", building: "フォーサイト", capacity: 361, examCapacity: 209, type: "normal", isMovable: false, equipment: ["PJ(横)", "天井モニター", "BD", "マイク", "白板", "ブラインド"] },
    { id: "F-401", name: "F-401", building: "フォーサイト", capacity: 154, examCapacity: 98, type: "normal", isMovable: true, equipment: ["PJ(中)", "BD", "マイク", "黒板", "ブラインド", "カーテン"] },
    { id: "F-402", name: "F-402", building: "フォーサイト", capacity: 154, examCapacity: 78, type: "normal", isMovable: true, equipment: ["PJ(中)", "BD", "マイク", "黒板", "ブラインド"] },
    { id: "F-403", name: "F-403", building: "フォーサイト", capacity: 130, examCapacity: 78, type: "normal", isMovable: true, equipment: ["PJ(中)", "BD", "マイク", "黒板", "ブラインド"] },
    { id: "F-404", name: "F-404", building: "フォーサイト", capacity: 120, examCapacity: 72, type: "normal", isMovable: true, equipment: ["PJ(中)", "BD", "マイク", "黒板", "ブラインド"] },
    { id: "F-501", name: "F-501", building: "フォーサイト", capacity: 126, examCapacity: 84, type: "normal", isMovable: false, equipment: ["PJ(中)", "BD", "マイク", "白板", "ブラインド", "カーテン"] },
    { id: "F-502", name: "F-502", building: "フォーサイト", capacity: 108, examCapacity: 63, type: "normal", isMovable: false, equipment: ["PJ(中)", "BD", "マイク", "白板", "ブラインド", "カーテン"] },
    { id: "F-503", name: "F-503", building: "フォーサイト", capacity: 90, examCapacity: 60, type: "normal", isMovable: false, equipment: ["PJ(中)", "BD", "マイク", "白板", "ブラインド", "カーテン"] },
    { id: "F-601", name: "F-601", building: "フォーサイト", capacity: 77, examCapacity: undefined, type: "normal", isMovable: true, equipment: ["PJ(中)", "BD", "マイク", "黒板", "ブラインド", "カーテン"] },
    { id: "F-602", name: "F-602", building: "フォーサイト", capacity: 24, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["黒板", "ブラインド"] },
    { id: "F-603", name: "F-603", building: "フォーサイト", capacity: 30, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["PJ(中)", "BD", "黒板", "ブラインド"] },
    { id: "F-604", name: "F-604", building: "フォーサイト", capacity: 30, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["黒板", "ブラインド"] },
    { id: "F-605", name: "F-605", building: "フォーサイト", capacity: 30, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["BD", "マイク", "黒板", "ブラインド"] },
    { id: "F-606", name: "F-606", building: "フォーサイト", capacity: 42, examCapacity: 28, type: "normal", isMovable: true, equipment: ["タッチディスプレイ", "BD", "黒板", "ブラインド"] },
    { id: "F-607", name: "F-607", building: "フォーサイト", capacity: 36, examCapacity: 24, type: "normal", isMovable: true, equipment: ["タッチディスプレイ", "BD", "黒板", "ブラインド"] },
    { id: "F-608", name: "F-608", building: "フォーサイト", capacity: 60, examCapacity: 38, type: "normal", isMovable: true, equipment: ["タッチディスプレイ", "BD", "黒板", "ブラインド"] },
    { id: "F-701", name: "F-701", building: "フォーサイト", capacity: 18, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["黒板", "ブラインド"] },
    { id: "F-702", name: "F-702", building: "フォーサイト", capacity: 12, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["白板", "ブラインド", "カーテン"] },
    { id: "F-703", name: "F-703", building: "フォーサイト", capacity: 63, examCapacity: undefined, type: "normal", isMovable: false, equipment: [] },
    { id: "F-704", name: "F-704", building: "フォーサイト", capacity: 90, examCapacity: undefined, type: "normal", isMovable: true, equipment: ["黒板", "ブラインド"] },
    { id: "F-705", name: "F-705", building: "フォーサイト", capacity: 87, examCapacity: 58, type: "normal", isMovable: false, equipment: ["PJ(横)", "BD"] },
    { id: "F-706", name: "F-706", building: "フォーサイト", capacity: 60, examCapacity: 40, type: "normal", isMovable: false, equipment: ["PJ(横)", "BD"] },
    { id: "F-707", name: "F-707", building: "フォーサイト", capacity: 30, examCapacity: undefined, type: "seminar", isMovable: false, equipment: ["PJ(横)", "BD"] },
    { id: "F-801", name: "F-801", building: "フォーサイト", capacity: 60, examCapacity: 40, type: "normal", isMovable: false, equipment: ["モニター", "BD"] },
    { id: "F-802", name: "F-802", building: "フォーサイト", capacity: 63, examCapacity: 41, type: "normal", isMovable: false, equipment: ["PJ(横)", "BD"] },
    { id: "F-803", name: "F-803", building: "フォーサイト", capacity: 90, examCapacity: 60, type: "normal", isMovable: true, equipment: ["PJ(中)", "BD", "マイク", "白板", "ブラインド"] },
    { id: "F-804", name: "F-804", building: "フォーサイト", capacity: 90, examCapacity: 60, type: "normal", isMovable: true, equipment: ["PJ(中)", "BD", "マイク", "白板", "ブラインド"] },
    { id: "F-805", name: "F-805", building: "フォーサイト", capacity: 87, examCapacity: 58, type: "normal", isMovable: true, equipment: ["PJ(中)", "BD", "マイク", "白板", "ブラインド"] },
    { id: "F-806", name: "F-806", building: "フォーサイト", capacity: 15, examCapacity: undefined, type: "seminar", isMovable: false, equipment: [] },
    { id: "F-807", name: "F-807", building: "フォーサイト", capacity: 15, examCapacity: undefined, type: "seminar", isMovable: false, equipment: [] },
    { id: "F-808", name: "F-808", building: "フォーサイト", capacity: 24, examCapacity: undefined, type: "seminar", isMovable: false, equipment: [] },
    { id: "F-901", name: "F-901", building: "フォーサイト", capacity: 52, examCapacity: 33, type: "normal", isMovable: true, equipment: ["タッチディスプレイ", "BD", "白板", "ブラインド"] },
    { id: "F-902", name: "F-902", building: "フォーサイト", capacity: 99, examCapacity: 66, type: "normal", isMovable: true, equipment: ["PJ(横)", "BD", "マイク", "白板", "ブラインド", "カーテン"] },
    { id: "F-903", name: "F-903", building: "フォーサイト", capacity: 99, examCapacity: 66, type: "normal", isMovable: true, equipment: ["PJ(横)", "BD", "マイク", "白板", "ブラインド", "カーテン"] },
    { id: "F-904", name: "F-904", building: "フォーサイト", capacity: 99, examCapacity: 66, type: "normal", isMovable: true, equipment: ["PJ(横)", "BD", "マイク", "白板", "ブラインド", "カーテン"] },
    { id: "3-201", name: "3-201", building: "3号館", capacity: 342, examCapacity: 171, type: "normal", isMovable: false, equipment: ["PJ(横)", "天井モニター", "BD", "マイク", "ブラインド"] },
    { id: "3-202", name: "3-202", building: "3号館", capacity: 198, examCapacity: 96, type: "normal", isMovable: false, equipment: ["PJ(横)", "BD", "マイク", "ブラインド"] },
    { id: "3-203", name: "3-203", building: "3号館", capacity: 70, examCapacity: 35, type: "normal", isMovable: true, equipment: ["PJ(横)", "BD", "マイク", "ブラインド"] },
    { id: "3-204", name: "3-204", building: "3号館", capacity: 70, examCapacity: 35, type: "normal", isMovable: true, equipment: ["PJ(横)", "BD", "マイク", "ブラインド"] },
    { id: "3-205", name: "3-205", building: "3号館", capacity: 96, examCapacity: 64, type: "normal", isMovable: true, equipment: ["PJ(横)", "BD", "マイク", "ブラインド"] },
    { id: "3-206", name: "3-206", building: "3号館", capacity: 96, examCapacity: 64, type: "normal", isMovable: true, equipment: ["PJ(横)", "BD", "マイク", "ブラインド"] },
    { id: "3-302", name: "3-302", building: "3号館", capacity: 72, examCapacity: undefined, type: "pc", isMovable: false, equipment: ["PJ(横)", "PC", "BD", "マイク", "白板", "ブラインド"] },
    { id: "3-303", name: "3-303", building: "3号館", capacity: 60, examCapacity: undefined, type: "pc", isMovable: false, equipment: ["PJ(横)", "PC", "BD", "マイク", "白板", "ブラインド"] },
    { id: "3-305", name: "3-305", building: "3号館", capacity: 28, examCapacity: undefined, type: "seminar", isMovable: false, equipment: ["PJ(中)", "白板", "ブラインド"] },
    { id: "3-306", name: "3-306", building: "3号館", capacity: 28, examCapacity: undefined, type: "seminar", isMovable: false, equipment: ["PJ(中)", "白板", "ブラインド"] },
    { id: "3-307", name: "3-307", building: "3号館", capacity: 28, examCapacity: undefined, type: "seminar", isMovable: false, equipment: ["PJ(中)", "白板", "ブラインド"] },
    { id: "3-308", name: "3-308", building: "3号館", capacity: 24, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["白板", "ブラインド", "カーテン"] },
    { id: "3-309", name: "3-309", building: "3号館", capacity: 18, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["モニター", "BD", "白板", "ブラインド", "カーテン"] },
    { id: "3-310", name: "3-310", building: "3号館", capacity: 18, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["モニター", "BD", "白板"] },
    { id: "3-405", name: "3-405", building: "3号館", capacity: 22, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["モニター", "BD", "白板"] },
    { id: "3-406", name: "3-406", building: "3号館", capacity: 24, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["モニター", "BD", "白板"] },
    { id: "3-407", name: "3-407", building: "3号館", capacity: 24, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["モニター", "BD", "白板"] },
    { id: "3-408", name: "3-408", building: "3号館", capacity: 22, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["モニター", "BD", "白板"] },
    { id: "3-409", name: "3-409", building: "3号館", capacity: 10, examCapacity: undefined, type: "seminar", isMovable: false, equipment: ["モニター", "BD", "白板"] },
    { id: "3-410", name: "3-410", building: "3号館", capacity: 10, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["モニター", "BD", "白板", "ブラインド", "カーテン"] },
    { id: "3-412", name: "3-412", building: "3号館", capacity: 20, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["タッチディスプレイ", "BD", "白板", "ブラインド", "カーテン"] },
    { id: "7-107", name: "7-107", building: "7号館", capacity: 558, examCapacity: 311, type: "normal", isMovable: false, equipment: ["PJ(中)", "BD", "マイク", "ブラインド"] },
    { id: "7-201", name: "7-201", building: "7号館", capacity: 260, examCapacity: 139, type: "normal", isMovable: false, equipment: ["PJ(横)", "BD", "マイク", "ブラインド"] },
    { id: "7-202", name: "7-202", building: "7号館", capacity: 90, examCapacity: 60, type: "normal", isMovable: true, equipment: ["PJ(横)", "BD", "マイク", "黒板", "ブラインド"] },
    { id: "7-203", name: "7-203", building: "7号館", capacity: 90, examCapacity: 60, type: "normal", isMovable: true, equipment: ["PJ(横)", "BD", "マイク", "黒板", "ブラインド"] },
    { id: "7-204", name: "7-204", building: "7号館", capacity: 51, examCapacity: 34, type: "normal", isMovable: true, equipment: ["PJ(中)", "白板", "ブラインド"] },
    { id: "7-205", name: "7-205", building: "7号館", capacity: 51, examCapacity: 34, type: "normal", isMovable: true, equipment: ["PJ(中)", "白板", "ブラインド"] },
    { id: "7-301", name: "7-301", building: "7号館", capacity: 260, examCapacity: 139, type: "normal", isMovable: false, equipment: ["PJ(横)", "BD", "マイク", "ブラインド"] },
    { id: "7-302", name: "7-302", building: "7号館", capacity: 90, examCapacity: 60, type: "normal", isMovable: true, equipment: ["PJ(横)", "BD", "マイク", "黒板", "ブラインド"] },
    { id: "7-303", name: "7-303", building: "7号館", capacity: 90, examCapacity: 60, type: "normal", isMovable: true, equipment: ["PJ(横)", "BD", "マイク", "黒板", "ブラインド"] },
    { id: "7-304", name: "7-304", building: "7号館", capacity: 51, examCapacity: 34, type: "normal", isMovable: true, equipment: ["PJ(中)", "白板", "ブラインド"] },
    { id: "7-305", name: "7-305", building: "7号館", capacity: 54, examCapacity: 36, type: "normal", isMovable: true, equipment: ["PJ(中)", "白板", "ブラインド", "カーテン"] },
    { id: "7-401", name: "7-401", building: "7号館", capacity: 259, examCapacity: 139, type: "normal", isMovable: false, equipment: ["PJ(横)", "BD", "マイク", "ブラインド", "カーテン"] },
    { id: "7-402", name: "7-402", building: "7号館", capacity: 90, examCapacity: 60, type: "normal", isMovable: true, equipment: ["PJ(横)", "BD", "マイク", "黒板", "ブラインド"] },
    { id: "7-403", name: "7-403", building: "7号館", capacity: 90, examCapacity: 60, type: "normal", isMovable: true, equipment: ["PJ(横)", "BD", "マイク", "黒板", "ブラインド"] },
    { id: "7-404", name: "7-404", building: "7号館", capacity: 51, examCapacity: 34, type: "normal", isMovable: true, equipment: ["PJ(中)", "白板", "ブラインド"] },
    { id: "7-405", name: "7-405", building: "7号館", capacity: 54, examCapacity: 34, type: "normal", isMovable: true, equipment: ["PJ(中)", "白板", "ブラインド", "カーテン"] },
    { id: "7-602", name: "7-602", building: "7号館", capacity: 18, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["白板", "ブラインド"] },
    { id: "7-603", name: "7-603", building: "7号館", capacity: 18, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["白板", "ブラインド"] },
    { id: "7-616", name: "7-616", building: "7号館", capacity: 16, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["白板", "ブラインド"] },
    { id: "8-101", name: "8-101", building: "8号館", capacity: 114, examCapacity: 62, type: "normal", isMovable: true, equipment: ["PJ(中)", "BD", "マイク", "黒板", "ブラインド"] },
    { id: "8-102", name: "8-102", building: "8号館", capacity: 60, examCapacity: 40, type: "normal", isMovable: true, equipment: ["PJ(中)", "黒板", "ブラインド"] },
    { id: "8-103", name: "8-103", building: "8号館", capacity: 119, examCapacity: 65, type: "normal", isMovable: false, equipment: ["PJ(中)", "BD", "マイク", "黒板", "ブラインド"] },
    { id: "8-105", name: "8-105", building: "8号館", capacity: 18, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["黒板", "ブラインド"] },
    { id: "8-106", name: "8-106", building: "8号館", capacity: 18, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["黒板", "ブラインド"] },
    { id: "8-107", name: "8-107", building: "8号館", capacity: 18, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["黒板", "ブラインド"] },
    { id: "8-201", name: "8-201", building: "8号館", capacity: 88, examCapacity: 56, type: "normal", isMovable: true, equipment: ["PJ(中)", "黒板", "白板", "ブラインド"] },
    { id: "8-202", name: "8-202", building: "8号館", capacity: 198, examCapacity: 126, type: "normal", isMovable: false, equipment: ["PJ(中)", "BD", "マイク", "黒板", "白板", "ブラインド", "カーテン"] },
    { id: "8-203", name: "8-203", building: "8号館", capacity: 143, examCapacity: 91, type: "normal", isMovable: false, equipment: ["PJ(中)", "BD", "マイク", "黒板", "白板", "ブラインド", "カーテン"] },
    { id: "8-204", name: "8-204", building: "8号館", capacity: 47, examCapacity: 27, type: "normal", isMovable: false, equipment: ["モニター", "黒板", "白板", "ブラインド", "カーテン"] },
    { id: "8-205", name: "8-205", building: "8号館", capacity: 47, examCapacity: 27, type: "normal", isMovable: false, equipment: ["モニター", "黒板", "白板"] },
    { id: "8-206", name: "8-206", building: "8号館", capacity: 47, examCapacity: 27, type: "normal", isMovable: true, equipment: ["モニター", "黒板", "白板", "ブラインド", "カーテン"] },
    { id: "8-207", name: "8-207", building: "8号館", capacity: 47, examCapacity: 27, type: "normal", isMovable: true, equipment: ["モニター", "黒板", "白板", "ブラインド", "カーテン"] },
    { id: "8-301", name: "8-301", building: "8号館", capacity: 140, examCapacity: 88, type: "normal", isMovable: false, equipment: ["PJ(中)", "BD", "マイク", "黒板", "白板", "ブラインド", "カーテン"] },
    { id: "8-302", name: "8-302", building: "8号館", capacity: 140, examCapacity: 88, type: "normal", isMovable: false, equipment: ["PJ(中)", "BD", "マイク", "黒板", "白板", "ブラインド", "カーテン"] },
    { id: "8-303", name: "8-303", building: "8号館", capacity: 141, examCapacity: 89, type: "normal", isMovable: false, equipment: ["PJ(中)", "BD", "マイク", "黒板", "白板", "ブラインド"] },
    { id: "8-304", name: "8-304", building: "8号館", capacity: 18, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["黒板", "ブラインド"] },
    { id: "8-305", name: "8-305", building: "8号館", capacity: 18, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["黒板", "ブラインド"] },
    { id: "8-306", name: "8-306", building: "8号館", capacity: 18, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["黒板", "ブラインド"] },
    { id: "8-307", name: "8-307", building: "8号館", capacity: 18, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["黒板", "ブラインド"] },
    { id: "8-308", name: "8-308", building: "8号館", capacity: 18, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["黒板", "白板", "ブラインド", "カーテン"] },
    { id: "8-309", name: "8-309", building: "8号館", capacity: 18, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["黒板", "白板", "ブラインド", "カーテン"] },
    { id: "8-310", name: "8-310", building: "8号館", capacity: 18, examCapacity: undefined, type: "seminar", isMovable: true, equipment: ["黒板", "白板", "ブラインド", "カーテン"] },
    { id: "8-401", name: "8-401", building: "8号館", capacity: 53, examCapacity: 32, type: "normal", isMovable: false, equipment: ["モニター", "黒板", "白板"] },
    { id: "8-402", name: "8-402", building: "8号館", capacity: 53, examCapacity: 32, type: "normal", isMovable: false, equipment: ["モニター", "TV", "黒板", "白板", "ブラインド", "カーテン"] },
    { id: "8-403", name: "8-403", building: "8号館", capacity: 53, examCapacity: 32, type: "normal", isMovable: false, equipment: ["モニター", "TV", "黒板", "白板", "ブラインド", "カーテン"] },
    { id: "8-404", name: "8-404", building: "8号館", capacity: 53, examCapacity: 32, type: "normal", isMovable: true, equipment: ["モニター", "PC", "黒板", "白板"] },
    { id: "8-405", name: "8-405", building: "8号館", capacity: 80, examCapacity: 48, type: "normal", isMovable: false, equipment: ["モニター", "BD", "黒板", "白板"] },
    { id: "8-406", name: "8-406", building: "8号館", capacity: 80, examCapacity: 48, type: "normal", isMovable: false, equipment: ["モニター", "黒板", "白板"] },
    { id: "8-407", name: "8-407", building: "8号館", capacity: 80, examCapacity: 48, type: "normal", isMovable: false, equipment: ["モニター", "黒板", "白板"] },
    { id: "8-408", name: "8-408", building: "8号館", capacity: 72, examCapacity: 48, type: "normal", isMovable: false, equipment: ["モニター", "黒板", "白板", "ブラインド", "カーテン"] },
    { id: "8-501", name: "8-501", building: "8号館", capacity: 310, examCapacity: 186, type: "normal", isMovable: true, equipment: ["PJ(横)", "BD", "マイク", "黒板", "ブラインド", "カーテン"] },
    { id: "8-502", name: "8-502", building: "8号館", capacity: 310, examCapacity: 186, type: "normal", isMovable: true, equipment: ["PJ(横)", "BD", "マイク", "黒板", "ブラインド", "カーテン"] },
    { id: "F-905", name: "F-905", building: "フォーサイト", capacity: 99, examCapacity: 66, type: "normal", isMovable: true, equipment: ["PJ(横)", "BD", "マイク", "白板", "ブラインド", "カーテン"] },
    { id: "F-907", name: "F-907", building: "フォーサイト", capacity: 60, examCapacity: 38, type: "normal", isMovable: true, equipment: ["タッチディスプレイ", "BD", "白板", "ブラインド"] },
    { id: "S-304", name: "S-304", building: "SCC", capacity: 60, examCapacity: undefined, type: "pc", isMovable: false, equipment: ["PJ(中)", "PC", "BD", "マイク", "白板", "ブラインド"] },
    { id: "S-305", name: "S-305", building: "SCC", capacity: 58, examCapacity: undefined, type: "pc", isMovable: false, equipment: ["PJ(中)", "PC", "BD", "マイク", "白板", "ブラインド"] },
];

const DEPARTMENTS = ['理', '工', '法', '経', '文', '他'];
const SUBJECT_NAMES = [
    'プログラミング入門', '基礎数学', 'アルゴリズム演習', '物理学', 'キャリアデザイン',
    'データベース論', '計算機アーキテクチャ', '離散構造', 'ソフトウェア工学', '人工知能概論',
    'ネットワーク論', '線形代数', '解析学', '確率統計', 'システム設計',
    '情報倫理', 'Web技術演習', 'モバイルアプリ開発', 'セキュリティ概論', 'OS論',
    '経営学入門', '経済学概論', '法学入門', '心理学基礎', '哲学演習'
];
const TEACHERS = ['山田太郎', '田中花子', '鈴木一人', '佐藤次郎', '伊藤美由紀', '渡辺健', '小林直樹', '加藤恵', '中村亮', '木村洋子'];
const FACULTIES = ['理工学部', '法学部', '経済学部', '文学部', '全学共通'];
const DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const generateSubjects = (count: number): Subject[] => {
    const subjects: Subject[] = [];
    for (let i = 1; i <= count; i++) {
        const id = `s${i}`;
        const faculty = FACULTIES[Math.floor(Math.random() * FACULTIES.length)];
        const term: Term = i % 10 === 0 ? 'full_year' : (i % 2 === 0 ? 'spring' : 'autumn');
        const day = DAYS[Math.floor(Math.random() * DAYS.length)];
        const period = (Math.floor(Math.random() * 5) + 1) as Period;

        // ランダムな機材要件の生成
        const equipList = ["BD", "マイク", "白板", "スクリーン", "WiFi", "黒板"];
        const reqEquip: string[] = [];
        const manEquip: string[] = [];

        // 30%の確率で機材要件を持つ
        if (Math.random() < 0.3) {
            const count = Math.floor(Math.random() * 2) + 1; // 1-2個
            for (let k = 0; k < count; k++) {
                const eq = equipList[Math.floor(Math.random() * equipList.length)];
                if (!reqEquip.includes(eq) && !manEquip.includes(eq)) {
                    // 50%で必須、50%で希望
                    if (Math.random() < 0.5) manEquip.push(eq);
                    else reqEquip.push(eq);
                }
            }
        }

        // 10%の確率で2講時連続にする
        const isMulti = Math.random() < 0.1 && period < 5;
        const endPeriod = isMulti ? (period + 1) as Period : undefined;

        subjects.push({
            id,
            code: `${String.fromCharCode(65 + (i % 26))}${1000 + i}`,
            name: `${SUBJECT_NAMES[i % SUBJECT_NAMES.length]}${i > SUBJECT_NAMES.length ? Math.floor(i / SUBJECT_NAMES.length) : ''}`,
            teacher: TEACHERS[i % TEACHERS.length],
            faculty,
            department: DEPARTMENTS[i % DEPARTMENTS.length],
            term,
            day,
            period,
            endPeriod,
            requiredCapacity: 20 + Math.floor(Math.random() * 200),
            campus: '寝屋川',
            requiresProjector: Math.random() < 0.5,
            requiredEquipment: reqEquip,
            mandatoryEquipment: manEquip,
            priority: Math.floor(Math.random() * 3) + 1,
            previousRooms: i % 5 === 0 ? [`3-${201 + (i % 6)}`] : [],
            requiredRoomCount: 1
        });
    }

    // --- 特定のサンプル追加 (月1-2) ---
    const samples: Subject[] = [
        {
            id: 'sample-multi-spring',
            code: 'X101',
            name: 'プログラミング演習A (サンプル)',
            teacher: '山田太郎',
            faculty: '理工学部',
            department: '理',
            term: 'spring',
            day: 'mon',
            period: 1,
            endPeriod: 2,
            requiredCapacity: 40,
            campus: '寝屋川',
            preferredRoomType: 'pc',
            requiresProjector: false,
            requiredEquipment: ['PJ(中)', '天井モニター', 'BD'],
            requiresMovable: false,
            priority: 1,
            previousRooms: ['3-302'],
            requiredRoomCount: 1
        },
        {
            id: 'sample-multi-autumn',
            code: 'X102',
            name: 'システム設計演習B (サンプル)',
            teacher: '田中花子',
            faculty: '工学部',
            department: '工',
            term: 'autumn',
            day: 'mon',
            period: 1,
            endPeriod: 2,
            requiredCapacity: 40,
            campus: '寝屋川',
            preferredRoomType: 'normal',
            requiresProjector: false,
            requiredEquipment: ['PJ(中)', 'BD'],
            requiresMovable: true,
            priority: 1,
            previousRooms: ['7-201'],
            requiredRoomCount: 1
        },
        {
            id: 'sample-multi-full',
            code: 'X103',
            name: '卒業研究 (サンプル)',
            teacher: '鈴木一人',
            faculty: '全学共通',
            department: '他',
            term: 'full_year',
            day: 'mon',
            period: 1,
            endPeriod: 2,
            requiredCapacity: 20,
            campus: '寝屋川',
            preferredRoomType: 'normal',
            requiresProjector: false,
            requiredEquipment: ['PJ(中)'],
            priority: 1,
            previousRooms: ['F-602'],
            requiredRoomCount: 1
        }
    ];

    return [...samples, ...subjects];
};

export const mockSubjects: Subject[] = generateSubjects(200);
