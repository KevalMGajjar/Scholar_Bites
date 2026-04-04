import 'package:hive_flutter/hive_flutter.dart';

class UserModel {
  final String id;
  final String name;
  final String email;
  final String role;
  final String universityId;
  final String universityName;
  final String userType;

  UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.universityId,
    this.universityName = '',
    this.userType = 'student',
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      role: json['role']?.toString() ?? 'student',
      universityId: json['university_id']?.toString() ?? '',
      universityName: json['university_name']?.toString() ?? '',
      userType: json['user_type']?.toString() ?? 'student',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'role': role,
      'university_id': universityId,
      'university_name': universityName,
      'user_type': userType,
    };
  }
}

class UserModelAdapter extends TypeAdapter<UserModel> {
  @override
  final int typeId = 2;

  @override
  UserModel read(BinaryReader reader) {
    final numFields = reader.readByte();
    final fields = <int, dynamic>{};
    for (int i = 0; i < numFields; i++) {
      fields[reader.readByte()] = reader.read();
    }
    return UserModel(
      id: fields[0] as String? ?? '',
      name: fields[1] as String? ?? '',
      email: fields[2] as String? ?? '',
      role: fields[3] as String? ?? 'student',
      universityId: fields[4] as String? ?? '',
      universityName: fields[5] as String? ?? '',
      userType: fields[6] as String? ?? 'student',
    );
  }

  @override
  void write(BinaryWriter writer, UserModel obj) {
    writer.writeByte(7); // number of fields
    writer.writeByte(0); writer.write(obj.id);
    writer.writeByte(1); writer.write(obj.name);
    writer.writeByte(2); writer.write(obj.email);
    writer.writeByte(3); writer.write(obj.role);
    writer.writeByte(4); writer.write(obj.universityId);
    writer.writeByte(5); writer.write(obj.universityName);
    writer.writeByte(6); writer.write(obj.userType);
  }
}
