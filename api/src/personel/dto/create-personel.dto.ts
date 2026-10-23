import { ApiPropertyOptional,ApiProperty } from "@nestjs/swagger";
import { MaxLength, IsString, IsNotEmpty,IsOptional,Matches,IsBoolean} from "class-validator";



export class CreatedWorkforceUserDto{
    @ApiProperty({description:'personel adı zorunludur.',example:'zilan'})
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    firstname:string;
    
    @ApiProperty({description:'personel soyadı zorunludur.',example:'fidan'})
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    lastname:string;

    @ApiProperty({description:'zorunlu ve benzersiz olmalı',example:'238447592103847'})
    @IsString()
    @IsNotEmpty()
    registrationNumber:string;

    @ApiPropertyOptional({description:'telefon numarası 5b ile başlayıp 10 haneli olmalıdır',example:'5353882217'})
    @IsOptional()
    @IsString()
    @Matches(/^5\d{9}$/)
    phone:string;

    @ApiPropertyOptional({description: 'Personelin aktiflik durumu',example: true,default: true,})
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;





}