TIKTOK TÀI ĐẸP TRAI v3.6.0 FINAL

Bản này giữ nguyên toàn bộ chức năng cũ, fix Kalodata sales_volume, hợp nhất EchoTik/Kalodata Shop Analytics vào thanh điều khiển video và tối ưu observer/timer.

CÀI ĐẶT
1. Giải nén thư mục.
2. Mở chrome://extensions -> bật Developer mode -> Load unpacked.
3. Chọn thư mục TikTok_Tai_Dep_Trai_v3.6.0_FINAL.
4. Reload toàn bộ tab TikTok đang mở.

SHOP ANALYTICS
- Popup: cấu hình EchoTik/Kalodata, API credentials, region/currency/range/cache.
- TikTok player: bấm nút API trên thanh điều khiển để xem và đổi khoảng thời gian.
- Kalodata: 7 ngày / 30 ngày / tháng YYYY-MM.
- EchoTik API Key: lifetime / 1 / 3 / 7 / 14 / 30 ngày / custom.
- EchoTik Legacy vẫn hoạt động để không phá cấu hình cũ.

Xem RELEASE_NOTES_v3.6.0.txt và TEST_REPORT_v3.6.0.txt để biết chi tiết.

--- GHI CHÚ TỪ CÁC BẢN TRƯỚC ---
TIKTOK TÀI ĐẸP TRAI v3.4.1
================================

Bản v3.4.1 giữ nguyên toàn bộ chức năng của v3.3.0, tiếp tục EchoTik Shop Analytics và bổ sung Kalodata Open API Video Detail để phân tích doanh thu/lượt bán/GMV theo video TikTok Shop.

ECHOTIK SHOP ANALYTICS
- Tự nhận diện video TikTok đang xem trên trang chi tiết/feed khi có Video ID hợp lệ.
- Gọi EchoTik Batch Video Detail API qua service worker, không gọi trực tiếp từ page context.
- Hiển thị: lượt bán ước tính, GMV ước tính, lượt xem, bán/1.000 view, GMV/đơn, like, bình luận và engagement.
- Widget EchoTik tách riêng khỏi Auto Replace/Audio Studio, nên lỗi API không làm hỏng player hoặc âm thanh.
- Có nút làm mới API thủ công cho video hiện tại.
- Cache tùy chọn 5/15/30/60/180 phút và giới hạn 120 video để giảm quota/tần suất gọi API.
- Chống gọi trùng cùng Video ID trong lúc request đang chạy.
- Timeout và thông báo riêng cho lỗi xác thực, rate-limit và lỗi server.

CẤU HÌNH ECHOTIK
1. Mở popup extension -> EchoTik Shop Analytics.
2. Nhập Username API và Password API EchoTik.
3. Bật EchoTik Analytics và bấm Lưu EchoTik.
4. Reload tab TikTok nếu tab đã mở trước khi cập nhật extension.
5. Mở/phát video; widget EchoTik xuất hiện ở góc phải.
6. Có thể bấm Phân tích video hiện tại hoặc Làm mới API để bỏ qua cache.

BẢO VỆ THÔNG TIN API
- Username/password được lưu bằng chrome.storage.local của extension.
- Key EchoTik không nằm trong allowlist Online Sync/Vercel của extension, nên không được đưa vào payload đồng bộ cài đặt hiện tại.
- Password không được ghi vào log hoặc DOM TikTok; service worker chỉ dùng để tạo Authorization header khi gọi EchoTik.
- Lưu ý: chrome.storage.local không phải kho mã hóa bí mật; chỉ cài extension/source từ nơi bạn tin cậy.

KALODATA SHOP ANALYTICS
- Tích hợp Kalodata Open API Video Detail: POST /openapi/v1/video/detail.
- Xác thực bằng header secret-key (Access Key Kalodata Open API).
- Body theo schema: region, language, currency, date_range, video_id.
- Hiển thị: Revenue/GMV, Sales Volume, Views, Video GPM, Ads ROAS, Ads Views, Ads Period, số sản phẩm, bán/1.000 view và GMV/đơn.
- API URL/Base URL cấu hình trong popup theo thông tin Open API được Kalodata cấp; extension nhận cả Base URL và full endpoint, hỗ trợ HTTPS thuộc kalodata.com hoặc kalowave.com.
- Kalodata và EchoTik chạy/cache độc lập, có thể bật một hoặc cả hai.
- Cache tùy chọn 5/15/30/60/180 phút, giới hạn 120 bản ghi; chống gọi trùng và timeout riêng.

CẤU HÌNH KALODATA
1. Mở popup extension -> Kalodata Shop Analytics.
2. Nhập API URL/Base URL do Kalodata cấp và Open API Access Key.
3. Chọn Region/Language/Currency và date_range (ví dụ last7Day, last30Day hoặc YYYY-MM).
4. Bật Kalodata Analytics và bấm Lưu Kalodata.
5. Reload tab TikTok nếu tab đã mở trước khi cập nhật extension.
6. Mở/phát video; widget Kalodata xuất hiện bên dưới widget EchoTik.

BẢO VỆ THÔNG TIN KALODATA
- Access Key và Base URL chỉ lưu chrome.storage.local, không nằm trong allowlist Online Sync/Vercel.
- Background chỉ gửi Access Key trong header secret-key tới hostname kalodata.com đã cấu hình.
- Access Key không được ghi vào DOM TikTok hoặc log giao diện.

GIỮ NGUYÊN TỪ v3.2.6
- Auto Replace HD và quy tắc không thay hover/grid preview.
- Player portrait/square/landscape, action rail avatar/tim/comment/share.
- Audio Studio, EQ 8 band, Adaptive Normalizer, Spatial 360°.
- Transcript365, TikTok Subtitle Translator, dịch VI.
- HD Download, video info, video stats, Watch Analytics.
- 1688 Image Search, Product Tools, proxy, Vercel/remote access.
- Background Play, Smart Auto Pause, auto-scroll và các chức năng cũ.

CÀI ĐẶT / TEST
1. Vào chrome://extensions hoặc edge://extensions.
2. Bật Developer mode -> Load unpacked -> chọn thư mục v3.4.1.
3. Reload/mở mới TikTok.
4. Test player/audio/subtitle/download/proxy như bản cũ.
5. Test EchoTik như bản v3.3.0.
6. Nhập Kalodata Open API URL/Base URL + Access Key và test một video có dữ liệu Kalodata.

LƯU Ý DỮ LIỆU
- Sales/GMV/Revenue hiển thị từ EchoTik/Kalodata là dữ liệu của các nền tảng phân tích bên thứ ba, không phải số đơn hàng chính thức của TikTok Shop Seller Center.
- Batch Video Detail là dữ liệu offline của EchoTik nên có thể có độ trễ hoặc chưa có dữ liệu cho một số video.
