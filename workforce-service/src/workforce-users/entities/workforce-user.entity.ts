import { Entity,Column,PrimaryGeneratedColumn,CreateDateColumn,UpdateDateColumn,ManyToOne,JoinColumn,Index } from "typeorm";
import {Matches} from 'class-validator';
import { Team } from "../../teams/entities/team.entity";

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

    // Personelin ekibi: her personel en fazla bir ekipte, ekipsiz olabilir (null)
    @Index()
    @Column({type:'int',nullable:true})
    teamId:number | null;

    // Üyesi olan ekip silinmek istenirse veritabanı da engeller (RESTRICT)
    @ManyToOne(() => Team, (team) => team.members, { nullable:true, onDelete:'RESTRICT' })
    @JoinColumn({ name:'team_id' })
    team:Team | null;

    @CreateDateColumn({type:'timestamptz'})
    createdAt:Date;

    @UpdateDateColumn({type:'timestamptz'})
    updatedAt:Date;


}
