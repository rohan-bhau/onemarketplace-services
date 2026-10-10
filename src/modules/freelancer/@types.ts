
interface LanguageData {
    language: string;
    proficiency: string
}

export interface PortfolioData {
    title: string;
    category: string;
    description: string;
    live_url: string | null;
    cover_image: {imageId: string; url:string}
}

export interface FreelancerProfileData{
    professional_title: string;
    professional_description: string;
    hourly_rate: string;
    country: string;
    city: string;
    availability_status: string;
    weekly_availability: string;
    experience_level: string;
    skills: string[];
    languages: LanguageData[];
    portfolios: PortfolioData[];
    identityVerified: boolean;
    joined_at: Date | null
}


export interface SavedFreelancerProfileInput {
  userId: string;
  professional_title: string;
  professional_description: string;
  hourly_rate: string;
  country: string;
  city: string;
  availability_status: string;
  weekly_availability: string;
  experience_level: string;
  skills: string[];
  languages: LanguageData[];
  portfolios: PortfolioData[];
}