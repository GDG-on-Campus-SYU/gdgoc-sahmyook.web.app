export type Activity = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content?: string;
  category: string;
  thumbnail?: string;
  images?: string[];
  startDate?: string;
  endDate?: string;
  status: string;
  generation?: string;
  participants?: string;
  host?: string;
  links?: string[];
  published?: boolean;
  placeholder?: boolean;
};

export type Project = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  description?: string;
  problem?: string;
  solution?: string;
  result?: string;
  thumbnail?: string;
  members?: string[];
  techStack?: string[];
  github?: string;
  demo?: string;
  generation?: string;
  published?: boolean;
  placeholder?: boolean;
};

export type Member = {
  id: string;
  name: string;
  role: "Organizer" | "Team Member" | "Member";
  position?: string;
  generation?: string;
  profileImage?: string;
  description?: string;
  github?: string;
  linkedin?: string;
  website?: string;
  visible?: boolean;
  order?: number;
};

export type Recruitment = {
  id: string;
  title: string;
  description: string;
  startDate?: string;
  endDate?: string;
  applyUrl?: string;
  status: "upcoming" | "open" | "closed";
  process?: string[];
  roles?: string[];
  faq?: Array<{ question: string; answer: string }>;
};
