import { Entity,Column,PrimaryGeneratedColumn,CreateDateColumn,UpdateDateColumn } from "typeorm";
import {Matches} from 'class-validator';

@Entity({ schema:'workforce',name:'workforce_user'})
export class WorkforceUser {

    @PrimaryGeneratedColumn()
    id:number;
     
    @Column({ name:'name',type: 'varchar',length:100,nullable:false })
    firstname:string;

    @Column({type: 'varchar',length:100,nullable:false})
    lastname:string;

    @Column({name:'register_number',type:'varchar',length:20,nullable:false,unique:true})
    registrationNumber:string;

    @Matches(/^5\d{9}$/)
    @Column({type:'varchar',length:10,nullable:true,})
    phone:string | null;

    @Column({type:'boolean',default:true})
    isActive:boolean;

    @CreateDateColumn({type:'timestamptz'})
    createdAt:Date;

    @UpdateDateColumn({type:'timestamptz'})
    updatedAt:Date;


}