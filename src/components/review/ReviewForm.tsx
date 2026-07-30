import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CitizenRecord } from '@/types/citizen';

interface ReviewFormProps {
  formData: CitizenRecord;
  handleInputChange: (field: keyof CitizenRecord, value: any) => void;
  setFormData: React.Dispatch<React.SetStateAction<CitizenRecord | null>>;
  onCheckDuplicate?: (idNumber: string, currentId: number) => void;
}

export function ReviewForm({ formData, handleInputChange, setFormData, onCheckDuplicate }: ReviewFormProps) {
  return (
    <div className="w-1/2 p-6 overflow-y-auto">
      <div className="space-y-8">

        <div className="space-y-4">
          <h3 className="font-semibold text-sm border-b pb-2 text-primary">I. THÔNG TIN PHIẾU</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>1. Số phiếu thu nhận</Label>
              <Input
                value={formData.receiptNumber || ''}
                onChange={e => handleInputChange('receiptNumber', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>2. Số hồ sơ cư trú</Label>
              <Input
                value={formData.residenceFileNumber || ''}
                onChange={e => handleInputChange('residenceFileNumber', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-sm border-b pb-2 text-primary">II. THÔNG TIN ĐỊNH DANH CÁ NHÂN</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>7. Số định danh cá nhân</Label>
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={formData.idNumber || ''}
                  onChange={e => handleInputChange('idNumber', e.target.value)}
                  className="font-bold font-mono text-primary flex-1"
                />
                <Button
                  variant="secondary"
                  onClick={() => onCheckDuplicate && formData.idNumber && formData.id && onCheckDuplicate(formData.idNumber, formData.id)}
                >
                  Kiểm tra
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>18. Số điện thoại</Label>
              <Input
                value={formData.phoneNumber || ''}
                onChange={e => handleInputChange('phoneNumber', e.target.value)}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>3. Họ, chữ đệm và tên</Label>
              <Input
                value={formData.fullName || ''}
                onChange={e => handleInputChange('fullName', e.target.value)}
                className="uppercase font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label>4. Tên gọi khác</Label>
              <Input
                value={formData.nickname || ''}
                onChange={e => handleInputChange('nickname', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>5. Ngày sinh</Label>
              <Input
                value={formData.birthDate || ''}
                onChange={e => handleInputChange('birthDate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>6. Giới tính</Label>
              <Select value={formData.gender || ''} onValueChange={val => handleInputChange('gender', val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn giới tính" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Nam">Nam</SelectItem>
                  <SelectItem value="Nữ">Nữ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>8. Số CMND 9 số</Label>
              <Input
                value={formData.idNumber9 || ''}
                onChange={e => handleInputChange('idNumber9', e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>9a. Dân tộc</Label>
              <Select value={formData.ethnicity || ''} onValueChange={val => handleInputChange('ethnicity', val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn dân tộc" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kinh">Kinh</SelectItem>
                  <SelectItem value="Tày">Tày</SelectItem>
                  <SelectItem value="Thái">Thái</SelectItem>
                  <SelectItem value="Mường">Mường</SelectItem>
                  <SelectItem value="Khmer">Khmer</SelectItem>
                  <SelectItem value="Hoa">Hoa</SelectItem>
                  <SelectItem value="Nùng">Nùng</SelectItem>
                  <SelectItem value="H'Mông">H'Mông</SelectItem>
                  <SelectItem value="Dao">Dao</SelectItem>
                  <SelectItem value="Gia Rai">Gia Rai</SelectItem>
                  <SelectItem value="Ê Đê">Ê Đê</SelectItem>
                  <SelectItem value="Ba Na">Ba Na</SelectItem>
                  <SelectItem value="Sán Chay">Sán Chay</SelectItem>
                  <SelectItem value="Chăm">Chăm</SelectItem>
                  <SelectItem value="Khác">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>9b. Tôn giáo</Label>
              <Select value={formData.religion || ''} onValueChange={val => handleInputChange('religion', val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn tôn giáo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Không">Không</SelectItem>
                  <SelectItem value="Phật giáo">Phật giáo</SelectItem>
                  <SelectItem value="Công giáo">Công giáo</SelectItem>
                  <SelectItem value="Thiên Chúa giáo">Thiên Chúa giáo</SelectItem>
                  <SelectItem value="Cao Đài">Cao Đài</SelectItem>
                  <SelectItem value="Hòa Hảo">Hòa Hảo</SelectItem>
                  <SelectItem value="Tin Lành">Tin Lành</SelectItem>
                  <SelectItem value="Hồi giáo">Hồi giáo</SelectItem>
                  <SelectItem value="Khác">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>9c. Quốc tịch</Label>
              <Input
                value={formData.nationality || ''}
                onChange={e => handleInputChange('nationality', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-sm border-b pb-2 text-primary">III. THÔNG TIN ĐỊA CHỈ & LIÊN LẠC</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>10. Nơi sinh</Label>
              <Input
                value={formData.birthPlace || ''}
                onChange={e => handleInputChange('birthPlace', e.target.value)}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>11. Nơi đăng ký khai sinh</Label>
              <Input
                value={formData.birthRegistration || ''}
                onChange={e => handleInputChange('birthRegistration', e.target.value)}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>12. Quê quán</Label>
              <Input
                value={formData.hometown || ''}
                onChange={e => handleInputChange('hometown', e.target.value)}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>13. Nơi thường trú</Label>
              <Input
                value={formData.permanentAddress || ''}
                onChange={e => handleInputChange('permanentAddress', e.target.value)}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>14. Nơi tạm trú</Label>
              <Input
                value={formData.temporaryAddress || ''}
                onChange={e => handleInputChange('temporaryAddress', e.target.value)}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>15. Nơi ở hiện tại</Label>
              <Input
                value={formData.currentAddress || ''}
                onChange={e => handleInputChange('currentAddress', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>16. Nghề nghiệp</Label>
              <Input
                value={formData.occupation || ''}
                onChange={e => handleInputChange('occupation', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>17. Nhóm máu</Label>
              <Input
                value={formData.bloodType || ''}
                onChange={e => handleInputChange('bloodType', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>19. Email</Label>
              <Input
                value={formData.email || ''}
                onChange={e => handleInputChange('email', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Thành viên gia đình (Mục 20)</h3>
            <Button variant="outline" size="sm" onClick={() => {
              setFormData(prev => prev ? {
                ...prev,
                familyMembers: [...(prev.familyMembers || []), { fullName: '', relationship: '', nationality: 'Việt Nam', idNumber: '', idNumber9: '' }]
              } : null)
            }}>Thêm người</Button>
          </div>

          {(!formData.familyMembers || formData.familyMembers.length === 0) && (
            <p className="text-xs text-muted-foreground italic">Không có dữ liệu thành viên gia đình.</p>
          )}

          {formData.familyMembers && formData.familyMembers.length > 0 && (
            <div className="space-y-3">
              {formData.familyMembers.map((member, idx) => (
                <div key={idx} className="border p-3 rounded-md bg-muted/20 relative group">
                  <button
                    onClick={() => {
                      setFormData(prev => prev ? {
                        ...prev,
                        familyMembers: prev.familyMembers.filter((_, i) => i !== idx)
                      } : null)
                    }}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div>
                      <Label className="text-xs">Mối quan hệ</Label>
                      <Input
                        className="h-8 text-xs"
                        value={member.relationship || ''}
                        onChange={e => {
                          const newMembers = [...formData.familyMembers];
                          newMembers[idx].relationship = e.target.value;
                          setFormData({ ...formData, familyMembers: newMembers });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Họ và tên</Label>
                      <Input
                        className="h-8 text-xs font-semibold"
                        value={member.fullName || ''}
                        onChange={e => {
                          const newMembers = [...formData.familyMembers];
                          newMembers[idx].fullName = e.target.value;
                          setFormData({ ...formData, familyMembers: newMembers });
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Số ĐDCN</Label>
                      <Input
                        className="h-8 text-xs font-mono"
                        value={member.idNumber || member.idNumber || ''}
                        onChange={e => {
                          const newMembers = [...formData.familyMembers];
                          newMembers[idx].idNumber = e.target.value;
                          setFormData({ ...formData, familyMembers: newMembers });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Số CMND 9 số</Label>
                      <Input
                        className="h-8 text-xs font-mono"
                        value={member.idNumber9 || ''}
                        onChange={e => {
                          const newMembers = [...formData.familyMembers];
                          newMembers[idx].idNumber9 = e.target.value;
                          setFormData({ ...formData, familyMembers: newMembers });
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-sm border-b pb-2 text-primary">IV. THÔNG TIN KHÁC</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>21. Đặc điểm nhận dạng</Label>
              <Input
                value={formData.distinguishingMarks || ''}
                onChange={e => handleInputChange('distinguishingMarks', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>22. Loại cấp</Label>
              <Input
                value={formData.issueType || ''}
                onChange={e => handleInputChange('issueType', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>23. Đơn vị lập</Label>
              <Input
                value={formData.issuingUnit || ''}
                onChange={e => handleInputChange('issuingUnit', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-sm border-b pb-2 text-primary">V. TÙY CHỌN CẤP THẺ (24-30)</h3>
          <div className="grid grid-cols-1 gap-3 border p-4 rounded-md bg-muted/10">
            <div className="flex items-center space-x-2">
              <Checkbox id="c24" checked={formData.requestDigitalCard} onCheckedChange={c => handleInputChange('requestDigitalCard', !!c)} />
              <Label htmlFor="c24" className="text-xs font-normal">24. Đề nghị cấp căn cước điện tử</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="c25" checked={formData.requestIntegrateOnCard} onCheckedChange={c => handleInputChange('requestIntegrateOnCard', !!c)} />
              <Label htmlFor="c25" className="text-xs font-normal">25. Đề nghị tích hợp thông tin vào thẻ Căn cước</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="c26" checked={formData.requestIntegrateDigital} onCheckedChange={c => handleInputChange('requestIntegrateDigital', !!c)} />
              <Label htmlFor="c26" className="text-xs font-normal">26. Đề nghị tích hợp thông tin vào thẻ Căn cước điện tử</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="c27" checked={formData.requestVerifyOldId} onCheckedChange={c => handleInputChange('requestVerifyOldId', !!c)} />
              <Label htmlFor="c27" className="text-xs font-normal">27. Đề nghị xác nhận số CMND, số ĐDCN đã hủy</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="c28" checked={formData.requestVerifyRevokedId} onCheckedChange={c => handleInputChange('requestVerifyRevokedId', !!c)} />
              <Label htmlFor="c28" className="text-xs font-normal">28. Đề nghị cấp Giấy xác nhận thông tin về cư trú</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="c29" checked={formData.requestDNACollection} onCheckedChange={c => handleInputChange('requestDNACollection', !!c)} />
              <Label htmlFor="c29" className="text-xs font-normal">29. Yêu cầu thu nhận thông tin sinh trắc học ADN</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="c30" checked={formData.requestVoiceCollection} onCheckedChange={c => handleInputChange('requestVoiceCollection', !!c)} />
              <Label htmlFor="c30" className="text-xs font-normal">30. Yêu cầu thu nhận thông tin sinh trắc học giọng nói</Label>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
