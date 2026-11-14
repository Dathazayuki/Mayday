# Danh sách API

> **Tài liệu chuẩn của dự án — sinh tự động bằng `docs/_tools/build_docs.py`, không sửa tay.**
> Bản chụp tài liệu gốc ngày **2026-11-14**. Nguồn: [Sheet API](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA); `tai-lieu-goc/SLIDE2..11`.
> Khi triển khai vẫn phải đối chiếu lại tài liệu gốc vì tài liệu gốc có thể đã thay đổi.

Tổng cộng **100** API (mỗi tab đặc tả trong Sheet là một API).

- **Method + đường dẫn (tên tab Sheet)**: lấy nguyên văn từ tên tab trong Sheet.
- **Đường dẫn ghi trong slide**: chỉ điền khi phần chữ của slide nêu cụ thể cho đúng API đó.
- Hai cột này đang lệch nhau về tiền tố `/api` và `/api/v1`, xem [05-mau-thuan-can-chot.md](../05-mau-thuan-can-chot.md).

| # | Phần | Mã slide | Tên trên slide | Method + đường dẫn (tên tab Sheet) | Đường dẫn ghi trong slide | Slide |
|---|---|---|---|---|---|---|
| 1 | [01](01-xac-thuc-tai-khoan.md) |  | signup | `1.1 signup` | `POST /api/v1/auth/signup` | SLIDE2 / 5 |
| 2 | [01](01-xac-thuc-tai-khoan.md) |  | login | `1.2 login` | `POST /api/v1/auth/login` | SLIDE2 / 9 |
| 3 | [01](01-xac-thuc-tai-khoan.md) |  | logout | `1.3 logout` | `POST /api/v1/auth/logout` | SLIDE2 / 12 |
| 4 | [01](01-xac-thuc-tai-khoan.md) |  | forgot-password | `1.4 forgot_password` | `POST /api/v1/auth/forgot-password` | SLIDE2 / 16 |
| 5 | [01](01-xac-thuc-tai-khoan.md) |  | change-password | `1.5 change_password` | `PUT /api/v1/auth/change-password` | SLIDE2 / 20 |
| 6 | [01](01-xac-thuc-tai-khoan.md) |  | create-staff | `1.6 create_staff` | `POST /api/v1/auth/admin/create-staff` | SLIDE2 / 24 |
| 7 | [01](01-xac-thuc-tai-khoan.md) |  | GET profile | `GET /api/profile` | `GET /api/v1/profile` | SLIDE2 / 28 |
| 8 | [01](01-xac-thuc-tai-khoan.md) |  | PUT profile | `PUT /api/profile` | `PUT /api/v1/profile` | SLIDE2 / 31 |
| 9 | [02](02-quan-tri-nguoi-dung-phan-quyen.md) | admin02 | get_list_users | `GET /api/admin/users/` | `GET /api/v1/admin/users` | SLIDE3 / 5 |
| 10 | [02](02-quan-tri-nguoi-dung-phan-quyen.md) | admin03 | get_user_details | `GET /api/admin/users/:id` | `GET /api/v1/admin/users/:id` | SLIDE3 / 8 |
| 11 | [02](02-quan-tri-nguoi-dung-phan-quyen.md) | admin01 | create_user | `POST /api/admin/users/` |  | SLIDE3 / 12 |
| 12 | [02](02-quan-tri-nguoi-dung-phan-quyen.md) | admin04 | edit_user | `PUT /api/admin/users/:id` |  | SLIDE3 / 13 |
| 13 | [02](02-quan-tri-nguoi-dung-phan-quyen.md) | admin05 | delete_user | `DELETE /api/admin/users/:id` | `DELETE /api/v1/admin/users/:id` | SLIDE3 / 14 |
| 14 | [02](02-quan-tri-nguoi-dung-phan-quyen.md) | admin06 | assign_user | `PUT /api/admin/users/:id/assign` | `PUT /api/v1/admin/users/:id/assign` | SLIDE3 / 18 |
| 15 | [02](02-quan-tri-nguoi-dung-phan-quyen.md) | role01 | set_role | `POST /api/roles` | `POST /api/v1/roles` | SLIDE3 / 22 |
| 16 | [02](02-quan-tri-nguoi-dung-phan-quyen.md) | role02 | get_role | `GET /api/roles` | `GET /api/v1/roles` | SLIDE3 / 23 |
| 17 | [02](02-quan-tri-nguoi-dung-phan-quyen.md) | perm01 | set_permission | `POST /api/v1/permissions` | `POST /api/v1/permissions` | SLIDE3 / 27 |
| 18 | [02](02-quan-tri-nguoi-dung-phan-quyen.md) | perm02 | get_list_permissions | `GET /api/v1/permissions` | `GET /api/v1/permissions` | SLIDE3 / 28 |
| 19 | [02](02-quan-tri-nguoi-dung-phan-quyen.md) | perm03 | edit_permission | `PUT /api/v1/permissions/:id` |  | SLIDE3 / 29 |
| 20 | [02](02-quan-tri-nguoi-dung-phan-quyen.md) | perm04 | delete_permission | `DELETE /api/v1/permissions/:id` |  | SLIDE3 / 30 |
| 21 | [02](02-quan-tri-nguoi-dung-phan-quyen.md) | roleperm01 | set_role_permissions | `POST /api/role_permissions` |  | SLIDE3 / 34 |
| 22 | [02](02-quan-tri-nguoi-dung-phan-quyen.md) | roleperm02 | get_role_permissions | `GET /api/role_permissions/role/:role_id` |  | SLIDE3 / 35 |
| 23 | [02](02-quan-tri-nguoi-dung-phan-quyen.md) | roleperm03 | delete_role_permissions | `DELETE /api/role_permissions/:role_id/:permission_id` |  | SLIDE3 / 36 |
| 24 | [03](03-co-so-vat-chat.md) | branch01 | set_branch | `POST /api/branches` |  | SLIDE4 / 5 |
| 25 | [03](03-co-so-vat-chat.md) | branch02 | get_list_branches | `GET /api/branches` |  | SLIDE4 / 6 |
| 26 | [03](03-co-so-vat-chat.md) | branch03 | get_branch_detail | `GET /api/v1/branches/:id` |  | SLIDE4 / 7 |
| 27 | [03](03-co-so-vat-chat.md) | branch04 | edit_branch | `PUT /api/v1/branches/:id` |  | SLIDE4 / 8 |
| 28 | [03](03-co-so-vat-chat.md) | branch05 | delete_branch | `DELETE /api/v1/branches/:id` |  | SLIDE4 / 9 |
| 29 | [03](03-co-so-vat-chat.md) | dept01 | set_department | `POST /api/departments` |  | SLIDE4 / 13 |
| 30 | [03](03-co-so-vat-chat.md) | dept02 | get_list_departments | `GET /api/departments` |  | SLIDE4 / 14 |
| 31 | [03](03-co-so-vat-chat.md) | dept03 | get_department_detail | `GET /api/v1/departments/:id` |  | SLIDE4 / 15 |
| 32 | [03](03-co-so-vat-chat.md) | dept04 | edit_department | `PUT /api/v1/departments/:id` |  | SLIDE4 / 16 |
| 33 | [03](03-co-so-vat-chat.md) | dept05 | delete_department | `DELETE /api/v1/departments/:id` |  | SLIDE4 / 17 |
| 34 | [03](03-co-so-vat-chat.md) | room01 | set_room | `POST /api/rooms` |  | SLIDE4 / 21 |
| 35 | [03](03-co-so-vat-chat.md) | room02 | get_list_rooms | `GET /api/rooms` |  | SLIDE4 / 22 |
| 36 | [03](03-co-so-vat-chat.md) | room03 | get_room_detail | `GET /api/v1/rooms/:id` |  | SLIDE4 / 23 |
| 37 | [03](03-co-so-vat-chat.md) | room04 | edit_room | `PUT /api/v1/rooms/:id` |  | SLIDE4 / 24 |
| 38 | [03](03-co-so-vat-chat.md) | room05 | delete_room | `DELETE /api/v1/rooms/:id` |  | SLIDE4 / 25 |
| 39 | [04](04-benh-nhan-benh-an.md) | docpat01 | search_patients | `GET /api/doctor/patients/search` |  | SLIDE5 / 5 |
| 40 | [04](04-benh-nhan-benh-an.md) | docpat02 | create_patient | `POST /api/doctor/patients/create` | `POST /api/v1/doctor/patients/` | SLIDE5 / 8 |
| 41 | [04](04-benh-nhan-benh-an.md) | medrec01 | get_medicalrecords_classifyquestions | `GET /api/medical_records/classify-questions` | `GET /api/v1/medical_records/classify-questions` | SLIDE5 / 13 |
| 42 | [04](04-benh-nhan-benh-an.md) | medrec02 | set_medicalrecords_classify | `POST /api/medical_records/classify` | `POST /api/v1/medical_records/classify` | SLIDE5 / 16 |
| 43 | [04](04-benh-nhan-benh-an.md) | medrec03 | set_medicalrecords_create | `POST /api/v1/medical_records` | `POST /api/v1/medical_records/` | SLIDE5 / 19 |
| 44 | [04](04-benh-nhan-benh-an.md) | medrec04 | get_medicalrecords_all | `GET /api/medical_records/all` | `GET /api/v1/medical_records/all` | SLIDE5 / 24 |
| 45 | [04](04-benh-nhan-benh-an.md) | medrec05 | get_medicalrecords_id | `GET /api/medical_records/:id` | `GET /api/v1/medical_records/:id` | SLIDE5 / 27 |
| 46 | [04](04-benh-nhan-benh-an.md) | medrec06 | get_medicalrecords_summary | `GET /api/medical_records/:id/summary` | `GET /api/v1/medical_records/:id/summary` | SLIDE5 / 30 |
| 47 | [04](04-benh-nhan-benh-an.md) | medrec13 | get_history_medicalrecords | `GET /api/medical_records/patients/:id/history` | `GET /api/v1/medical_records/patients/:id/history` | SLIDE5 / 33 |
| 48 | [04](04-benh-nhan-benh-an.md) | medrec07 | set_accept_medicalrecords | `POST /api/medical_records/:id/accept` | `POST /api/v1/medical_records/:id/accept` | SLIDE5 / 37 |
| 49 | [04](04-benh-nhan-benh-an.md) | medrec11 | credit_medicalrecords | `PUT /api/medical_records/:id` | `PUT /api/v1/medical_records/:id` | SLIDE5 / 40 |
| 50 | [04](04-benh-nhan-benh-an.md) | medrec08 | get_medicalrecords_answers | `GET /api/medical_records/:id/answers` | `GET /api/v1/medical_records/:id/answers` | SLIDE5 / 44 |
| 51 | [04](04-benh-nhan-benh-an.md) | medrec10 | update_medicalrecords_answers | `PUT /api/medical_records/:id/answers` | `PUT /api/v1/medical_records/:id/answers` | SLIDE5 / 47 |
| 52 | [04](04-benh-nhan-benh-an.md) | medrec14 | delete_medicalrecords | `DELETE /api/medical_records/:id` | `DELETE /api/v1/medical_records/:id/` | SLIDE5 / 50 |
| 53 | [04](04-benh-nhan-benh-an.md) |  |  | `POST /api/medical_records/:id/answers` |  | không có slide |
| 54 | [04](04-benh-nhan-benh-an.md) |  |  | `PATCH /api/medical_records/:id/status` |  | không có slide |
| 55 | [05](05-uas7.md) | uas701 | get_uas7scores_eligibility | `GET /api/uas7-scores/eligibility` | `GET /api/v1/uas7-scores/eligibility` | SLIDE6 / 5 |
| 56 | [05](05-uas7.md) | uas702 | create_uas7scores | `POST /api/uas7-scores/` | `POST /api/v1/uas7-scores` | SLIDE6 / 9 |
| 57 | [05](05-uas7.md) | uas704 | get_uas7scores_patient | `GET /api/uas7-scores/patient/:patientId` | `GET /api/v1/uas7-scores/patient/:patient_id` | SLIDE6 / 13 |
| 58 | [05](05-uas7.md) |  |  | `GET /api/uas7-scores/week/:patientId` |  | không có slide |
| 59 | [06](06-don-thuoc-xet-nghiem.md) | rx01 | create_prescription | `POST /api/prescriptions/` | `POST /api/v1/prescriptions` | SLIDE7 / 5 |
| 60 | [06](06-don-thuoc-xet-nghiem.md) | lab01 | create_lab_request | `POST /api/lab-requests` | `POST /api/v1/lab-requests` | SLIDE7 / 9 |
| 61 | [06](06-don-thuoc-xet-nghiem.md) | lab02 | get_lab_results | `GET /api/lab-results/:record_id` | `GET /api/v1/lab-results/:record_id` | SLIDE7 / 13 |
| 62 | [07](07-kho-anh-tep-dinh-kem.md) | img01 | upload_image_attachment | `POST /api/image-attachments/upload` | `POST /api/v1/image-attachments/upload` | SLIDE8 / 5 |
| 63 | [07](07-kho-anh-tep-dinh-kem.md) | img03 | get_image_attachments_user | `GET /api/image-attachments/user/:user_id` | `GET /api/v1/image-attachments/user/:user_id` | SLIDE8 / 9 |
| 64 | [07](07-kho-anh-tep-dinh-kem.md) | img05 | delete_image_attachment | `DELETE /api/image-attachments/:id` | `DELETE /api/v1/image-attachments/:id` | SLIDE8 / 13 |
| 65 | [07](07-kho-anh-tep-dinh-kem.md) | ansimg01 | set_answer_image | `POST /api/answer-images/` | `POST /api/v1/answer-images` | SLIDE8 / 17 |
| 66 | [07](07-kho-anh-tep-dinh-kem.md) | ansimg03 | get_answer_images | `GET /api/answer-images/:answer_id` | `GET /api/v1/answer-images/:answer_id` | SLIDE8 / 21 |
| 67 | [07](07-kho-anh-tep-dinh-kem.md) | ansimg04 | delete_answer_image | `DELETE /api/answer-images/:id` | `DELETE /api/v1/answer-images/:id` | SLIDE8 / 25 |
| 68 | [07](07-kho-anh-tep-dinh-kem.md) |  |  | `POST /api/image-attachments/upload-multiple` |  | không có slide |
| 69 | [07](07-kho-anh-tep-dinh-kem.md) |  |  | `GET /api/image-attachments/view/:id` |  | không có slide |
| 70 | [07](07-kho-anh-tep-dinh-kem.md) |  |  | `POST /api/answer-images/bulk` |  | không có slide |
| 71 | [08](08-ton-thuong-da.md) | lesion02 | create_lesion_episode | `POST /api/lesion-episodes/` | `POST /api/v1/lesion-episodes` | SLIDE9 / 5 |
| 72 | [08](08-ton-thuong-da.md) | lesion01 | get_my_lesion_episodes | `GET /api/lesion-episodes/my` | `GET /api/v1/lesion-episodes/my` | SLIDE9 / 9 |
| 73 | [08](08-ton-thuong-da.md) | lesion06 | get_lesion_episode | `GET /api/lesion-episodes/:id` | `GET /api/v1/lesion-episodes/:id` | SLIDE9 / 12 |
| 74 | [08](08-ton-thuong-da.md) | lesion03 | edit_lesion_episode | `PATCH /api/lesion-episodes/:id` | `PATCH /api/v1/lesion-episodes/:id` | SLIDE9 / 15 |
| 75 | [08](08-ton-thuong-da.md) | lesion04 | delete_lesion_episode | `DELETE /api/lesion-episodes/:id` | `DELETE /api/v1/lesion-episodes/:id` | SLIDE9 / 19 |
| 76 | [08](08-ton-thuong-da.md) | loc01 | create_lesion_location | `POST /api/lesion-locations/` | `POST /api/v1/lesion-locations` | SLIDE9 / 23 |
| 77 | [08](08-ton-thuong-da.md) | loc03 | get_lesion_locations_by_episode | `GET /api/lesion-locations/episode/:episode_id` | `GET /api/v1/lesion-locations/episode/:episode_id` | SLIDE9 / 27 |
| 78 | [08](08-ton-thuong-da.md) | loc04 | edit_lesion_location | `PATCH /api/lesion-locations/:id` | `PATCH /api/v1/lesion-locations/:id` | SLIDE9 / 30 |
| 79 | [08](08-ton-thuong-da.md) | loc05 | delete_lesion_location | `DELETE /api/lesion-locations/:id` | `DELETE /api/v1/lesion-locations/:id` | SLIDE9 / 34 |
| 80 | [08](08-ton-thuong-da.md) | lphoto01 | set_lesion_photos | `POST /api/lesion-photos/` | `POST /api/v1/lesion-photos` | SLIDE9 / 38 |
| 81 | [08](08-ton-thuong-da.md) | lphoto02 | get_lesion_photos_by_location | `GET /api/lesion-photos/location/:location_id` | `(slide chép nhầm mô tả của loc03: GET /api/v1/lesion-locations/episode/:episode_id)` | SLIDE9 / 42 |
| 82 | [08](08-ton-thuong-da.md) | lphoto03 | edit_lesion_photo_milestone | `PATCH /api/lesion-photos/:id/milestone` | `PATCH /api/v1/lesion-photos/:id/milestone` | SLIDE9 / 45 |
| 83 | [08](08-ton-thuong-da.md) | lphoto04 | delete_lesion_photo | `DELETE /api/lesion-photos/:id` | `DELETE /api/v1/lesion-photos/:id` | SLIDE9 / 49 |
| 84 | [08](08-ton-thuong-da.md) |  |  | `GET /api/lesion-episodes/record/:medical_record_id` |  | không có slide |
| 85 | [09](09-thong-bao.md) | token01 | set_devtoken | `POST /api/notifications/register_token` | `POST /api/v1/notifications/` | SLIDE10 / 5 |
| 86 | [09](09-thong-bao.md) | notif01 | get_notification | `GET /api/notifications` | `GET /api/v1/notifications/` | SLIDE10 / 9 |
| 87 | [09](09-thong-bao.md) | notif02 | set_read_notification | `PUT /api/notifications/{id}` | `PUT /api/v1/notifications/:id/read` | SLIDE10 / 13 |
| 88 | [09](09-thong-bao.md) | notif04 | delete_notification | `DELETE /api/notifications/:id` | `DELETE /api/v1/notifications/:id` | SLIDE10 / 17 |
| 89 | [10](10-mau-phieu-kham-dong.md) | tmpl01 | set_template | `POST /api/templates/` | `POST /api/v1/templates` | SLIDE11 / 5 |
| 90 | [10](10-mau-phieu-kham-dong.md) | tmpl02 | get_list_templates | `GET /api/templates/all` | `GET /api/v1/templates/all` | SLIDE11 / 8 |
| 91 | [10](10-mau-phieu-kham-dong.md) | tmpl03 | get_template_detail | `GET /api/templates/:id` | `GET /api/v1/templates/:id` | SLIDE11 / 11 |
| 92 | [10](10-mau-phieu-kham-dong.md) | tmpl04 | edit_template | `PUT /api/templates/:id` | `PUT /api/v1/templates/:id` | SLIDE11 / 14 |
| 93 | [10](10-mau-phieu-kham-dong.md) | tmpl05 | delete_template | `DELETE /api/templates/:id` | `DELETE /api/v1/templates/:id` | SLIDE11 / 17 |
| 94 | [10](10-mau-phieu-kham-dong.md) | sec01 | set_template_section | `POST /api/templates/:template_id/sections` | `POST /api/v1/templates/:template_id/sections` | SLIDE11 / 21 |
| 95 | [10](10-mau-phieu-kham-dong.md) | sec02 | edit_template_section | `PUT /api/templates/sections/:id` | `PUT /api/v1/templates/sections/:id` | SLIDE11 / 24 |
| 96 | [10](10-mau-phieu-kham-dong.md) | sec03 | delete_template_section | `DELETE /api/templates/sections/:id` | `DELETE /api/v1/templates/sections/:id` | SLIDE11 / 27 |
| 97 | [10](10-mau-phieu-kham-dong.md) | ques01 | set_template_question | `POST /api/templates/sections/:section_id/questions` | `POST /api/v1/templates/sections/:section_id/questions` | SLIDE11 / 31 |
| 98 | [10](10-mau-phieu-kham-dong.md) | ques02 | edit_template_question | `PUT /api/templates/questions/:id` | `PUT /api/v1/templates/questions/:id` | SLIDE11 / 35 |
| 99 | [10](10-mau-phieu-kham-dong.md) | ques03 | delete_template_question | `DELETE /api/templates/questions/:id` | `DELETE /api/v1/templates/questions/:id` | SLIDE11 / 39 |
| 100 | [11](11-ai-du-doan-anh.md) |  |  | `POST /api/ai/predict/image` |  | không có slide |

Tài liệu chi tiết từng phần:

- [01-xac-thuc-tai-khoan](01-xac-thuc-tai-khoan.md)
- [02-quan-tri-nguoi-dung-phan-quyen](02-quan-tri-nguoi-dung-phan-quyen.md)
- [03-co-so-vat-chat](03-co-so-vat-chat.md)
- [04-benh-nhan-benh-an](04-benh-nhan-benh-an.md)
- [05-uas7](05-uas7.md)
- [06-don-thuoc-xet-nghiem](06-don-thuoc-xet-nghiem.md)
- [07-kho-anh-tep-dinh-kem](07-kho-anh-tep-dinh-kem.md)
- [08-ton-thuong-da](08-ton-thuong-da.md)
- [09-thong-bao](09-thong-bao.md)
- [10-mau-phieu-kham-dong](10-mau-phieu-kham-dong.md)
- [11-ai-du-doan-anh](11-ai-du-doan-anh.md)
- [00-quy-uoc-va-ma-phan-hoi.md](00-quy-uoc-va-ma-phan-hoi.md)
