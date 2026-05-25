import { differenceInYears, isValid, parseISO } from 'date-fns';
import { GroupMember } from './ct-types';

export function getMemberBirthday(member: GroupMember): string | null {
  return member.personFields?.birthday ?? (member.person as any).birthday ?? (member.person.domainAttributes as any)?.birthday ?? null;
}

export function getMemberAge(member: GroupMember): number | null {
  const birthdayStr = getMemberBirthday(member);
  if (!birthdayStr) return null;
  const birthday = parseISO(String(birthdayStr));
  if (!isValid(birthday)) return null;
  const age = differenceInYears(new Date(), birthday);
  return age > 0 ? age : null;
}